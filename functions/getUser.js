import _ from 'lodash';

import * as dynamoDbUtils from '../utils/dynamo';
import * as constants from '../constants';
import { success, serverFailure, failure } from '../utils/response';
import { getUserKeysWithoutSecrets } from '../models/user';
import { isLambdaWarmer } from '../utils/warmer';
import { requireAuth } from '../utils/auth';

export async function main(event) {
  return new Promise(async (resolve, reject) => {
    if (isLambdaWarmer(event)) return resolve(success());

    await requireAuth(event, reject, constants.JWT.TYPES.USER);

    const userId = _.get(event, 'queryStringParameters.userId');
    const email = _.get(event, 'queryStringParameters.email');
    const username = _.get(event, 'queryStringParameters.username');
    let params;

    if (!userId && !username && !email) {
      console.error('Invalid Request: missing required params');
      return reject(failure(400, 'Invalid Request: missing required params'));
    }

    if (userId) {
      params = {
        TableName: constants.AWS.DYNAMO_USERS_TABLE,
        Key: { userId },
        AttributesToGet: getUserKeysWithoutSecrets()
      };

      console.info('params: ', params);

      try {
        const result = await dynamoDbUtils.call('get', params);
        const user = result.Item;

        console.info('result: ', result);

        if (!user) {
          return resolve(success({
            status: 'No user found',
            user: {}
          }));
        }

        return resolve(success({ user: result.Item }));
      } catch (err) {
        console.error('server error getting the user: ', err);
        return reject(serverFailure('Server error getting the user', err));
      }
    } else if (username) {
      params = {
        TableName: constants.AWS.DYNAMO_USERS_TABLE,
        IndexName: 'username-index',
        KeyConditionExpression: 'username = :username',
        ExpressionAttributeValues: dynamoDbUtils.getExpressionAttributeValues({ username })
      };
    } else if (email) {
      params = {
        TableName: constants.AWS.DYNAMO_USERS_TABLE,
        IndexName: 'primaryEmail-index',
        KeyConditionExpression: 'primaryEmail = :primaryEmail',
        ExpressionAttributeValues: dynamoDbUtils.getExpressionAttributeValues({ primaryEmail: email })
      };
    }

    console.info('params: ', params);

    try {
      const result = await dynamoDbUtils.call('query', params);
      const user = result.Items[0];

      console.info('result: ', result);

      if (!user) {
        return resolve(success({
          status: 'No user found',
          user: {}
        }));
      }

      delete user.password;

      return resolve(success({ user }));
    } catch (err) {
      console.error('server error getting the user: ', err);
      return reject(serverFailure('Server error getting the user', err));
    }
  });
}
