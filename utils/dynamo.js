import AWS from './aws';

export function call(action, params) {
  const dynamo = new AWS.DynamoDB.DocumentClient();

  return dynamo[action](params).promise();
}

export function getUpdateExpression(data) {
  let updateExpression = 'SET';

  Object.entries(data).forEach(([key], index) => {
    if (index > 0) {
      updateExpression = `${updateExpression},`;
    }

    updateExpression = `${updateExpression} #${key} = :${key}`;
  });

  return updateExpression;
}

export function getExpressionAttributeNames(data) {
  let expressionValues = {};

  Object.entries(data).forEach(([key]) => {
    expressionValues[`#${key}`] = key;
  });

  return expressionValues;
}

export function getExpressionAttributeValues(data) {
  let expressionValues = {};

  Object.entries(data).forEach(([key, value]) => {
    expressionValues[`:${key}`] = value;
  });

  return expressionValues;
}
