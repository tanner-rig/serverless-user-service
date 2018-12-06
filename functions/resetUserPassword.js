import moment from 'moment';
import _ from 'lodash';
import bcrypt from 'bcryptjs';

import * as constants from '../constants';
import * as dynamoDbUtils from '../utils/dynamo';
import { failure, serverFailure, success } from '../utils/response';
import { getCurrentDatetime } from '../utils/time';
import { getUser } from '../models/user';
import { isLambdaWarmer } from '../utils/warmer';

export async function main(event) {
  return new Promise(async (resolve, reject) => {
    if (isLambdaWarmer(event)) return resolve(success());
    
    const data = JSON.parse(event.body);
    const datetime = getCurrentDatetime();

    console.info('Event Received: ', data);

    if (!data.resetPasswordToken || !data.newPassword) {
      console.error('Invalid Request: missing required params');
      return reject(failure(400, 'Invalid Request: missing required params'));
    }

    try {
      const queryParams = {
        TableName: constants.AWS.DYNAMO_USERS_TABLE,
        IndexName: 'resetPasswordToken-index',
        KeyConditionExpression: 'resetPasswordToken = :resetPasswordToken',
        ExpressionAttributeValues: dynamoDbUtils.getExpressionAttributeValues({ resetPasswordToken: data.resetPasswordToken })
      };

      console.info('queryParams: ', queryParams);

      // Get user to set the password for
      const response = await dynamoDbUtils.call('query', queryParams);
      const user = _.get(response, 'Items[0]');

      console.info('response: ', response);

      if (!user) {
        return reject(failure(404, 'no user with this setPasswordToken found in db'));
      } else if (!user.resetPasswordExpiration || moment().isAfter(user.resetPasswordExpiration)) {
        return reject(failure(401, 'resetPasswordToken has expired'));
      }

      // Hash the newPassword
      bcrypt.hash(data.newPassword, 11, async (err, hashedPassword) => {
        if (err) {
          console.error('error hashing the user\'s newPassword: ', err);
          return reject(serverFailure('error hashing the user\'s newPassword: ', err));
        }

        console.info('hashedPassword: ', hashedPassword);

        const updatedUser = getUser({
          ...user,
          password: hashedPassword,
          updatedAt: datetime
        });

        delete updatedUser.resetPasswordToken;
        delete updatedUser.resetPasswordExpiration;

        const putParams = {
          TableName: constants.AWS.DYNAMO_USERS_TABLE,
          Item: updatedUser
        };

        console.info('putParams: ', putParams);

        // write the updatedUser to the database
        const result = await dynamoDbUtils.call('put', putParams);

        console.info('result: ', result);

        return resolve(success({ status: 'user password reset successfully' }));
      });
    } catch (err) {
      console.error('error setting user password: ', err);
      return reject(serverFailure('error setting user password: ', err));
    }
  });
}
