import mail from '@sendgrid/mail';

import { SENDGRID, AWS } from '../constants';
import * as dynamoDbUtils from '../utils/dynamo';
import { success, failure, serverFailure } from '../utils/response';
import { getCurrentDatetime } from '../utils/time';
import { isLambdaWarmer } from '../utils/warmer';
import { getUniqueValidationToken } from '../models/user';

mail.setApiKey(SENDGRID.API_KEY);

export async function main(event) {
  return new Promise(async (resolve, reject) => {
    if (isLambdaWarmer(event)) return resolve(success());
    
    const data = JSON.parse(event.body);
    const { email } = data;

    if (!email) {
      return reject(failure(400, 'request body must contain email property'));
    }

    const queryParams = {
      TableName: AWS.DYNAMO_USERS_TABLE,
      IndexName: 'primaryEmail-index',
      KeyConditionExpression: 'primaryEmail = :email',
      ExpressionAttributeValues: dynamoDbUtils.getExpressionAttributeValues({ email })
    };

    try {
      const users = await dynamoDbUtils.call('query', queryParams);

      if (!users.Items.length) {
        // if email is not in our database we just return a success so we don't validate if an email exists in our system
        return resolve(success());
      }

      const user = users.Items[0];
      const updatedUser = {
        resetPasswordToken: getUniqueValidationToken(),
        resetPasswordExpiration: Math.floor((Date.now() / 1000) + (60 * 30)),
        updatedAt: getCurrentDatetime()
      };
      const updateParams = {
        TableName: AWS.DYNAMO_USERS_TABLE,
        Key: { userId: user.userId },
        UpdateExpression: dynamoDbUtils.getUpdateExpression(updatedUser),
        ExpressionAttributeNames: dynamoDbUtils.getExpressionAttributeNames(updatedUser),
        ExpressionAttributeValues: dynamoDbUtils.getExpressionAttributeValues(updatedUser),
        ReturnValues: 'ALL_NEW'
      };

      await dynamoDbUtils.call('update', updateParams);

      const msg = {
        to: user.email,
        from: 'forgot-password@tannerrigby.com',
        templateId: SENDGRID.USER_FORGOT_PASSWORD_TEMPLATE_ID,
        dynamic_template_data: {
          dashboardUri: process.env.DASHBOARD_URI,
          resetPasswordToken: updatedUser.resetPasswordToken
        }
      };

      await mail.send(msg);

      return resolve(success({ status: 'forgotPasswordToken created and emailed to user successfully' }));
    } catch (err) {
      console.error('server error creating forgotPasswordToken: ', err);
      reject(serverFailure('server error creating forgotPasswordToken: ', err));
    }
  });
}
