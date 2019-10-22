const appdynamics4graphql = (context, appdynamics, options) => {

  const { inferWithField, defaultBT, debug } = Object.assign({inferWithField: false, defaultBT: 'IntrospectionQuery', debug: false }, options)

  debugFunction = typeof debug === 'function' ? debug : (debug === true ? console.log : () => {});

  return async ({ req }) => {
    try {
      // Make sure that a query is defined, otherwise this might not be a graphql request.
      // TODO: Check for graphql path?
      if(req.body && req.body.hasOwnProperty('query')) {
        if(req.body.operationName) {
          console.log('BT is', req.body.operationName);
          appdynamics.startTransaction(req.body.operationName);
        } else {
          // Remove all comments
          const query = req.body.query.split(/(?:\r\n|\n|\r)/).filter(line => !line.startsWith('#')).join('\n');
          // Seperate SelectionSet from OperationDefinition
          const [ operationDefinition, selectionSet ] = query.replace(/(\s)+/gm,' ').split('{').map(e => e.trim());

          let operationType = 'query';
          let operationName = '';
          if(operationDefinition !== '') {
            debugFunction(operationDefinition.split(/[\(@]/)[0].match(/([_A-Za-z][_0-9A-Za-z]+)/g));
            [operationType, operationName ] = operationDefinition.split(/[\(@]/)[0].match(/([_A-Za-z][_0-9A-Za-z]+)/g);
          }
          if(!operationName) {
            let field = inferWithField ? (' ' + selectionSet.match(/^([_A-Za-z][_0-9A-Za-z]*)/)[0]) : '';
            operationType = inferWithField ? operationType : 'unnamed' + operationType.charAt(0).toUpperCase() + operationType.slice(1);
            appdynamics.startTransaction(operationType+field);
            debugFunction('BT is', operationType+field);
          } else {
            debugFunction('BT is', operationName);
            appdynamics.startTransaction(operationName);
          }
        }
      }
    } catch (e) {
      // Do nothing, BT detection failed
      debugFunction('BT is', defaultBT);
      debugFunction(e);
    } finally {
      return typeof context === 'function' ? await context({ req }) : null;
    }
  };
};

module.exports = {
  appdynamics4graphql
}
