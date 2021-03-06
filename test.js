var assert = require('assert');

const { appdynamics4graphql } = require('./index.js');


let result;

const appdynamics = {
  getTransaction: () => {
    return {
      end: () => {}
    }
  },
  startTransaction: (b) => {
    result.btName = b
    return {
      eumEnabled: true,
      time: {
        threadId: 1
      },
      agent: {
        context: {
          get: () => {
            return 1
          }
        },
        proxy: {
          before: () => {

          }
        }
      },
      addSnapshotData: (key, value) => {
        result.snapshotData[key] = value
      },
      addAnalyticsData: (key, value) => {
        result.analyticsData[key] = value
      },
      end: function () {
        result.isFinished = true
      },
      markError: function(_, statusCode) {
        result.errorCode = statusCode
      }
    }
  }
}

const options = {
  debug: false
}

const res = {
  statusCode: 200,
  finishCallback: () => {},
  on: function(event, func) {
    if(event === 'finish') {
      this.finishCallback = func
    }
  }
}


const body = {
  query: ''
}

const req = {
  body
}

const examples = {
  withFragments: `query withFragments {
    user(id: 4) {
      friends(first: 10) {
        ...friendFields
      }
      mutualFriends(first: 10) {
        ...friendFields
      }
    }
  }`,
  inlineFragmentNoType: `query inlineFragmentNoType($expandedInfo: Boolean) {
    user(handle: "zuck") {
      id
      name
      ... @include(if: $expandedInfo) {
        firstName
        lastName
        birthday
      }
    }
  }`
}

function resetResult() {
  result = {
   btName: 'unset',
   snapshotData: {},
   analyticsData: {},
   isFinished: false,
   errorCode: 0
 }
}

function assertBtName(q, expectedName, operationName = false) {
  resetResult();
  body.query = q
  if(body.operationName !== false) {
    body.operationName = operationName
  } else {
    delete body.operationName
  }
  appdynamics4graphql(appdynamics, options)(req, res, () => {})
  assert.equal(result.btName, expectedName)
  res.finishCallback();
  assert(result.isFinished)
}

describe('appdynamics-nodejs-extras', function() {
  describe('#appdynamics4graphql()', function() {
    it('It should name the btName unnamedQuery for an empty query', function() {

      resetResult()
      appdynamics4graphql(appdynamics, options)({}, res, () => {})
      assert.equal(result.btName, 'unknownQuery')
      assert.equal(result.snapshotData['appdynamics4graphql-error'], "Request body does not contain query.")

      assertBtName('', 'unnamedQuery')
      assertBtName('{}', 'unnamedQuery')
    });
    it('It should name mutation and subscriptions as unnamedMutation and unnamedSubscription', function() {
      assertBtName('mutation {}', 'unnamedMutation')
      assertBtName('subscription {}', 'unnamedSubscription')
    });
    it('It should leverage operationName if provided', function() {
      assertBtName('mutation {}', 'TestOperation', 'TestOperation')
      assert.equal(result.snapshotData.operationType, 'mutation')
      assertBtName('subscription TestOperation {}', 'TestOperation')
      assert.equal(result.snapshotData.operationType, 'subscription')
      assertBtName(examples.withFragments, 'withFragments'),
      assertBtName(examples.inlineFragmentNoType, 'inlineFragmentNoType')
    });
    it('It should call the query by default name if an exception occurs', function() {
      assertBtName(null, 'unknownQuery')
      assert.equal(result.snapshotData['appdynamics4graphql-error'], "TypeError: Cannot read property \'split\' of null")
    });
    it('It should infer the query with field if set as option.', function() {
      options.inferWithField = true
      assertBtName('{ status }', 'query status')
      assertBtName('{ luke: hero(id: "1000") { name } }', 'query luke')
      options.inferWithField = false
    })
    it('It should mark a transaction as error if statusCode is > 400', function() {
      res.statusCode = 500;
      assertBtName('{}', 'unnamedQuery')
      assert.equal(result.errorCode, 500)
      res.statusCode = 200;
    })
  });
});
