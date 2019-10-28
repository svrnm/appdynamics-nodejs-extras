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
      time: {
        threadId: 1
      },
      agent: {
        context: {
          get: () => {
            return 1
          }
        }
      },
      addSnapshotData: (key, value) => {
        result.snapshotData[key] = value
      },
      addAnalyticsData: (key, value) => {
        result.analyticsData[key] = value
      }
    }
  }
}

const options = {
  debug: false
}

const res = {
  on: () => {}
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
   analyticsData: {}
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
}

describe('appdynamics-nodejs-extras', function() {
  describe('#appdynamics4graphql()', function() {
    it('It should name the btName unnamedQuery for an empty query', function() {
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
      assertBtName(null, 'IntrospectionQuery')
      assert.equal(result.snapshotData['appdynamics4graphql-error'], "TypeError: Cannot read property \'split\' of null")
    });
    it('', function() {
      options.inferWithField = true
      assertBtName('{ status }', 'query status')
      assertBtName('{ luke: hero(id: "1000") { name } }', 'query luke')
      options.inferWithField = false
    })
  });
});
