# AppDynamics Node.JS Extras

This package includes additional functionality for the AppDynamics Node.JS agent.

## BTs for GraphQL

Use the `appdynamics4graphql` middleware with apollo-server-express to have an out of the box detection of business transactions for your GraphQL application:

```javascript
const appdynamics = require("appdynamics");
const { appdynamics4graphql } = require('appdynamics-nodejs-extras')
...
// Set options for appdynamics4graphql
const options = { ... }
const app = express()
app.use(json(), appdynamics4graphql(appdynamics, {debug: true}))
const server = new ApolloServer({
  ...
})
server.applyMiddleware({ app })
app.listen({ port: 4000 }, () => console.log(`app running`));
```

With this your operation names will be reported as business transactions. If you don't provide an operation name the context wrapper will use the operation type as identifier (`query`, `mutation` or `subscription`) and call the BTs `unnamedQuery`, `unnamedMutation` and `unnamedSubscription`. If an error occurs or no name can be extracted, the default BT name is `IntrospectionQuery`.

You can reconfigure this default behaviour by setting the following options:

* `inferWithField` (default: `false`): If set to true and if no operation name is provided, this will add the "root name" of your operation to the BT name. So instead of `unnamedQuery` you will get a BT named `query fieldname`.
* `defaultBt` (default: `"IntrospectionQuery"`): Change the name of the default BT.
* `debug` (default: `false`): If set to true, there will be messages logged to `console`. As alternative you can provide a function that will be used to log those messages.
* `addSnapshotData` (default: `true`): If set to true, add `operationName` and `operationType` to snapshot data.
* `addAnalyticsData` (default: `true`): If set to true, add `opartionName` and `operationType` to analytics data.
* `logQuery` (default: `false`): If set to true, the received GraphQL query will be logged into snapshot data (no analytics!).
* `logRequestHeaders`: (default: `[]`): Provide a list of response headers that should be collected into snapshot data/analytics data.
* `logResponseHeaders`: (default: `[]`): Provide a list of response headers that should be collected into snapshot data/analytics data.
* `withCCID` (default: `true`): Create a custom correlation ID, send it to analytics/snapshot data and create a custom header called `appdynamics-graphql-ccid`, that is collectable on the frontend site.
* `withResponseHook` (default: `false`): If set to true, error information is collected from the query response. If you provide a callback function you can access the response, the response body, a method to collect data and the transaction object:
  ```javascript
  options.withResponseHook = (response, body, collectData, transaction) => {
    collectData('errorId', body.errors[0].id)
  }
  ```
