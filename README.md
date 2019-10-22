# AppDynamics Node.JS Extras

This package includes additional functionality for the AppDynamics Node.JS agent.

## BTs for GraphQL

Use the `appdynamics4graphql` context wrapper with apollo-server to have an out of the box detection of business transactions for your GraphQL application:

```javascript
const appdynamics = require("appdynamics");
const { appdynamics4graphql } = require('appdynamics-nodejs-extras')
...
// Set options for appdynamics4graphql
const options = { ... }
// Set up Apollo Server
const server = new ApolloServer({
  context: appdynamics4graphql(context, appdynamics, options),
  ...
});
```

With this your operation names will be reported as business transactions. If you don't provide an operation name the context wrapper will use the operation type as identifier (`query`, `mutation` or `subscription`) and call the BTs `unnamedQuery`, `unnamedMutation` and `unnamedSubscription`. If an error occurs or no name can be extracted, the default BT name is `IntrospectionQuery`.

You can reconfigure this default behaviour by setting the following options:

* `inferWithField` (default: `false`): If set to true and if no operation name is provided, this will add the "root name" of your operation to the BT name. So instead of `unnamedQuery` you will get a BT named `query fieldname`.
* `defaultBT` (default: `"IntrospectionQuery"`): Change the name of the default BT.
* `debug` (default: `false`): If set to true, there will be messages logged to `console`. As alternative you can provide a function that will be used to log those messages.
