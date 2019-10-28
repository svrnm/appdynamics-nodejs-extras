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
    operationType
  }
}

const appdynamics4graphql = (appdynamics, options) => {

  const {
    inferWithField,
    defaultBt,
    debug,
    addSnapshotData,
    addAnalyticsData,
    logQuery,
    exclusive
   } = Object.assign({
     inferWithField: false,
     defaultBt: 'IntrospectionQuery',
     debug: false,
     addSnapshotData: true,
     addAnalyticsData: true,
     logQuery: false,
     exclusive: true
   }, options)

  const debugFunction = typeof debug === 'function' ? debug : (debug === true ? console.log : () => {});

  function collectData(tnx, key, value) {
    if(addSnapshotData) {
      debugFunction('Adding ' + key + ' and ' + value + ' to snapshot data');
      tnx.addSnapshotData(key, value)
    }
    if(addAnalyticsData) {
      debugFunction('Adding ' + key + ' and ' + value + ' to analytics data');
      tnx.addAnalyticsData(key, value)
    }
  }

  function startTransaction(btName, data, query, exception) {
    debugFunction('BT is', btName);
    const tnx = appdynamics.startTransaction(btName)
    const myThreadId = tnx.time.threadId
    if(tnx.agent.context.get('threadId') !== myThreadId) {
      debugFunction('Setting threadId to', myThreadId)
      tnx.agent.context.set('threadId', myThreadId)
    }
    if(data !== false) {
      Object.keys(data).forEach(key => {
        collectData(tnx, key, data[key])
      })
    }
    if(query !== false && logQuery) {
      // collectData(tnx, 'graphql-query', query)
    }
    if(exception !== false) {
      tnx.addSnapshotData('appdynamics4graphql-error', exception.toString())
    }
    return tnx
  }

  return (req, res, next) => {
    let tnx = null
    if(exclusive) {
      const oldTnx = appdynamics.getTransaction(req);
      if(oldTnx) {
        debugFunction('Ending existing business transaction')
        oldTnx.end()
      }
    }
    try {
      // Make sure that a query is defined, otherwise this might not be a graphql request.
      // TODO: Check for graphql path?
      if(req.body && req.body.hasOwnProperty('query')) {
        let btName = defaultBt
        let { operationName, operationType } = extractOperation(req.body.query)
        if(req.body.operationName) {
          operationName = req.body.operationName
          btName = operationName
        } else {
          debugFunction(operationName, operationType)
          if(!operationName) {
            let field = inferWithField ? (' ' + selectionSet.match(/^([_A-Za-z][_0-9A-Za-z]*)/)[0]) : '';
            operationType = inferWithField ? operationType : 'unnamed' + operationType.charAt(0).toUpperCase() + operationType.slice(1);
            btName = operationType+field;
          } else {
            btName = operationName;
          }
        }
        tnx = startTransaction(btName, { operationName, operationType }, req.body.query, false)
      } else {
        startTransaction(defaultBt, false, false)
        debugFunction('No body or no query set')
      }
    } catch (e) {
      debugFunction(e)
      tnx = startTransaction(defaultBt, false, false, e)
    } finally {
      if (tnx) {
        debugFunction('Attaching onResponse complete handler')
        tnx.onResponseComplete = (req, res) => {
          debugFunction('Terminating business transaction')
          tnx.end()
        }
      }
      next()
    }
  };
};

module.exports = {
  appdynamics4graphql
}
