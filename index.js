function addEumCookie(debugFunction, transaction, agent, res, req) {
  try {
    var agent = transaction.agent

    var eumEnabled = (transaction.eumEnabled && !transaction.skip) || (agent.eum.enabled && agent.eum.enabledForTransaction(req));

    if (!transaction.corrHeader && eumEnabled) {
      agent.proxy.before(res, 'writeHead', function (obj) {
        if(!transaction.isFinished) {
          var eumCookie = self.agent.eum.newEumCookie(transaction, req, obj, false);
          eumCookie.build();
        }
      });
    }
  } catch (e) {
    debugFunction(e)
  }
}

function extractOperation(string) {
  // Remove all comments
  const query = string.split(/(?:\r\n|\n|\r)/).filter(line => !line.startsWith('#')).join('\n');
  // Seperate SelectionSet from OperationDefinition
  const [ operationDefinition, selectionSet ] = query.replace(/(\s)+/gm,' ').split('{').map(e => e.trim());

  let operationType = 'query';
  let operationName = '';
  if(operationDefinition !== '') {
    // debugFunction(operationDefinition.split(/[\(@]/)[0].match(/([_A-Za-z][_0-9A-Za-z]+)/g));
    [operationType, operationName ] = operationDefinition.split(/[\(@]/)[0].match(/([_A-Za-z][_0-9A-Za-z]+)/g);
  }
  return {
    operationName,
    operationType,
    selectionSet
  }
}

function infer(inferWithField, selectionSet, operationType) {
  let field = inferWithField ? (' ' + selectionSet.match(/^([_A-Za-z][_0-9A-Za-z]*)/)[0]) : '';
  operationType = inferWithField ? operationType : 'unnamed' + operationType.charAt(0).toUpperCase() + operationType.slice(1);
  return operationType+field;
}

function processResponse(debugFunction, collectData, chuncks, transaction) {
  if(chuncks.length === 0) {
    debugFunction('Body is empty')
    return false
  }
  let body = ''
  try {
    body = JSON.parse(typeof chuncks[0] === 'string' ? chuncks.join('') : Buffer.concat(chuncks).toString('utf8'));
  } catch(e) {
    debugFunction('Body is not json')
    return false
  }
  if(body.errors && body.errors.length > 0) {
    debugFunction('Errors detected')
    const error = body.errors[0]
    let errorObject = new Error(body.errors[0].message)
    if(error.extensions) {
      errorObject.code = error.extensions.exception.code
      errorObject.stack = error.extensions.exception.stacktrace.join('\n')
    }
    transaction.markError(errorObject)
    if(body.errors.length > 1) {
      body.errors.forEach((error,index) => {
        collectData(transaction, 'error-'+index+'-message', error.message)
      })
    }
    return true
  }
}

const appdynamics4graphql = (appdynamics, options) => {

  const {
    inferWithField,
    defaultBt,
    debug,
    addSnapshotData,
    addAnalyticsData,
    logRequestHeaders,
    logResponseHeaders,
    logQuery,
    exclusive,
    withEum,
    withResponseHook
   } = Object.assign({
     inferWithField: false,
     defaultBt: 'unknownQuery',
     debug: false,
     addSnapshotData: true,
     addAnalyticsData: true,
     logQuery: false,
     logRequestHeaders: [],
     logResponseHeaders: [],
     exclusive: true,
     withEum: true,
     withResponseHook: true
   }, options)

  const debugFunction = typeof debug === 'function' ? debug : (debug === true ? console.log : () => {});

  function collectData(transaction, key, value) {
    if(addSnapshotData) {
      debugFunction('Adding ' + key + ' and ' + value + ' to snapshot data');
      transaction.addSnapshotData(key, value)
    }
    if(addAnalyticsData) {
      debugFunction('Adding ' + key + ' and ' + value + ' to analytics data');
      transaction.addAnalyticsData(key, value)
    }
  }

  function startTransaction(btName, data, query, exception = false) {
    debugFunction('BT is', btName);
    const transaction = appdynamics.startTransaction(btName)

    const myThreadId = transaction.time.threadId
    if(transaction.agent.context.get('threadId') !== myThreadId) {
      debugFunction('Setting threadId to', myThreadId)
      transaction.agent.context.set('threadId', myThreadId)
    }
    if(data !== false) {
      Object.keys(data).forEach(key => {
        collectData(transaction, key, data[key])
      })
    }
    if(query !== false && logQuery) {
      collectData(transaction, 'graphql-query', query)
    }
    if(exception !== false) {
      transaction.addSnapshotData('appdynamics4graphql-error', exception.toString())
    }
    return transaction
  }

  return (req, res, next) => {
    let transaction = null
    if(false /* exclusive */) {
      const oldTransaction = appdynamics.getTransaction(req);
      if(oldTransaction) {
        debugFunction('Ending existing business transaction')
        oldTransaction.end()
      }
    }
    try {
      // Make sure that a query is defined, otherwise this might not be a graphql request.
      // TODO: Check for graphql path?
      if(req.body && req.body.hasOwnProperty('query')) {
        let btName = defaultBt
        let { operationName, operationType, selectionSet } = extractOperation(req.body.query)
        debugFunction('Extracted operation', operationName, operationType, selectionSet)
        if(req.body.operationName) {
          operationName = req.body.operationName
          btName = operationName
        } else {
          debugFunction(operationName, operationType)
          if(!operationName) {
            btName = infer(inferWithField, selectionSet, operationType)
          } else {
            btName = operationName;
          }
        }
        transaction = startTransaction(btName, { operationName, operationType }, req.body.query, false)
      } else {
        startTransaction(defaultBt, false, false, 'Request body does not contain query.')
        debugFunction('No body or no query set')
      }
    } catch (e) {
      debugFunction(e)
      transaction = startTransaction(defaultBt, false, (req && req.body && req.body.query ? req.body.query : false), e)
    } finally {
      try {
        if (transaction) {
          if(Array.isArray(logRequestHeaders)) {
            logRequestHeaders.forEach(header => {
              if(req.headers[header]) {
                collectData(transaction, 'request-header-' + header, req.headers[header])
              }
            })
          }
          if(withEum) {
            addEumCookie(debugFunction, transaction, res, req)
          }
          debugFunction('Attaching onResponse complete handler')
          const once = (chunck) => {
            console.log(chunck)
            //res.removeEventListener(once)
          }

          let chuncks = []
          if(withResponseHook) {
            debugFunction('Hooking into res.write')
            const oldWrite = res.write;
            res.write = function(chunck) {
              chuncks.push(chunck)
              oldWrite.apply(res, arguments);
            }
          }

          res.on('finish', () => {
            try {
              let hasErrors = false
              if(withResponseHook) {
                hasErrors = processResponse(debugFunction, collectData, chuncks, transaction)
              }
              if (!hasErrors && res.statusCode > 399 && res.statusCode < 600) {
                debugFunction('Marking BT as error: ' + res.statusCode)
                transaction.markError(new Error(), res.statusCode)
              }
              debugFunction('Terminating business transaction')
              if(Array.isArray(logResponseHeaders)) {
                logResponseHeaders.forEach(header => {
                  if(res.hasHeader(header)) {
                    collectData(transaction, 'response-header-' + header, res.getHeader(header))
                  }
                })
              }
              transaction.end()
            } catch(e) {
              debugFunction(e)
            }
          })
        }
      } catch(e) {
        debugFunction(e)
      }
      next()
    }
  };
};

module.exports = {
  appdynamics4graphql
}
