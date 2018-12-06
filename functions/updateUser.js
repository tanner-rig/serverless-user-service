import * as dynamoDbUtils from '../utils/dynamo';
import * as constants from '../constants';
import { success, serverFailure } from '../utils/response';
import { getCurrentDatetime } from '../utils/time';
import { getUser } from '../models/user';
import { isLambdaWarmer } from '../utils/warmer';
import { requireAuth } from '../utils/auth';

export async function main(event) {
  return new Promise(async (resolve, reject) => {
    if (isLambdaWarmer(event)) return resolve(success());

    event.body = JSON.parse(event.body);

    await requireAuth(event, reject, constants.JWT.TYPES.USER);

    const datetime = getCurrentDatetime();
    const user = {
      ...getUser(event.body),
      updatedAt: datetime
    };
    const params = {
      TableName: constants.AWS.DYNAMO_USERS_TABLE,
      Key: { userId: event.pathParameters.userId },
      UpdateExpression: dynamoDbUtils.getUpdateExpression(user),
      ExpressionAttributeNames: dynamoDbUtils.getExpressionAttributeNames(user),
      ExpressionAttributeValues: dynamoDbUtils.getExpressionAttributeValues(user),
      ReturnValues: 'ALL_NEW'
    };

    console.info('user: ', user);
    console.info('params: ', params);

    try {
      const result = await dynamoDbUtils.call('update', params);

      console.info('result: ', result);

      resolve(success({ status: 'user updated successfully', user }));
    } catch (e) {
      console.error('server error updating the user: ', e.response);
      reject(serverFailure('Server error updating the user', e.response));
    }
  });
}
