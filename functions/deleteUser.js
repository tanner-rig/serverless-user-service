import * as dynamoDbUtils from '../utils/dynamo';
import * as constants from '../constants';
import { success, serverFailure, failure } from '../utils/response';
import { getCurrentDatetime } from '../utils/time';
import { getUserKeysWithoutSecrets } from '../models/user';
import { isLambdaWarmer } from '../utils/warmer';
import { requireAuth } from '../utils/auth';

export async function main(event) {
  return new Promise(async (resolve, reject) => {
    if (isLambdaWarmer(event)) return resolve(success());

    await requireAuth(event, reject, constants.JWT.TYPES.USER);

    const datetime = getCurrentDatetime();
    const data = { status: constants.USER_STATUS.DELETED, updatedAt: datetime };
    const queryParams = {
      TableName: constants.AWS.DYNAMO_USERS_TABLE,
      Key: { userId: event.pathParameters.userId },
      AttributesToGet: getUserKeysWithoutSecrets()
    };
    const updateParams = {
      TableName: constants.AWS.DYNAMO_USERS_TABLE,
      Key: { userId: event.pathParameters.userId },
      UpdateExpression: dynamoDbUtils.getUpdateExpression(data),
      ExpressionAttributeNames: dynamoDbUtils.getExpressionAttributeNames(data),
      ExpressionAttributeValues: dynamoDbUtils.getExpressionAttributeValues(data),
      ReturnValues: 'ALL_NEW'
    };

    console.info('data: ', data);
    console.info('queryParams: ', queryParams);
    console.info('updateParams: ', updateParams);

    try {
      const queryResult = await dynamoDbUtils.call('get', queryParams);
      console.info('queryResult: ', queryResult);

      if (!queryResult.Item) {
        return reject(failure(404, { error: 'No user found with this id to be able to delete' }));
      }

      const result = await dynamoDbUtils.call('update', updateParams);
      delete result.Attributes.password;
      console.info('result: ', result);
      resolve(success({ status: 'user deleted successfully' }));
    } catch (e) {
      console.error('server error setting user status to \'DELETED\': ', e.response);
      reject(serverFailure('Server error deleting the user', e.response));
    }
  });
}
