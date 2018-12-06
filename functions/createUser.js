import uuid from 'uuid';
import _ from 'lodash';
import mail from '@sendgrid/mail';
import bcrypt from 'bcryptjs';

import * as constants from '../constants';
import * as dynamoDbUtils from '../utils/dynamo';
import { failure, serverFailure, success } from '../utils/response';
import { getCurrentDatetime } from '../utils/time';
import { getUser, getUniqueValidationToken } from '../models/user';
import { isLambdaWarmer } from '../utils/warmer';
import { getJWT } from '../utils/jwt';

mail.setApiKey(constants.SENDGRID.API_KEY);

export async function main(event) {
  return new Promise(async (resolve, reject) => {
    if (isLambdaWarmer(event)) return resolve(success());

    event.body = JSON.parse(event.body);

    const data = event.body;
    const datetime = getCurrentDatetime();
    let existingEmail;

    console.info('Event Received: ', data);

    if (!data.email || !data.password) {
      console.error('Invalid Request: missing required params');
      return reject(failure(400, 'Invalid Request: missing required params'));
    }

    // lowercase the email address
    data.email = _.toLower(data.email);

    // Check to see if user exists for this email already
    const emailQueryParams = {
      TableName: constants.AWS.DYNAMO_USERS_TABLE,
      IndexName: 'primaryEmail-index',
      KeyConditionExpression: 'primaryEmail = :primaryEmail',
      ExpressionAttributeValues: dynamoDbUtils.getExpressionAttributeValues({
        primaryEmail: data.email
      })
    };

    console.info('emailQueryParams: ', emailQueryParams);

    try {
      const queryResults = await dynamoDbUtils.call('query', emailQueryParams);
      console.info('queryResults: ', queryResults);

      existingEmail = _.find(queryResults.Items, { primaryEmail: data.email });
    } catch (err) {
      console.error('server error getting the email: ', err);
      return reject(
        serverFailure('Server error getting the email', err.response)
      );
    }

    // If email already exists don't allow new user to be created
    if (existingEmail) {
      return resolve(success({ emailAlreadyExists: true, success: false }));
    }

    // Hash the password
    bcrypt.hash(data.password, 11, async (err, hashedPassword) => {
      if (err) {
        console.error("error hashing the user's password: ", err);
        return reject(
          serverFailure("error hashing the user's password: ", err.response)
        );
      }

      // Create a new user
      const user = getUser({
        userId: uuid.v1(),
        primaryEmail: data.email,
        password: hashedPassword,
        status: constants.USER_STATUS.ACTIVE,
        emailValidationToken: getUniqueValidationToken(),
        emailValidationExpiration: Math.floor(Date.now() / 1000 + 60 * 60 * 24),
        createdAt: datetime,
        updatedAt: datetime
      });

      const putParams = {
        TableName: constants.AWS.DYNAMO_USERS_TABLE,
        Item: user
      };

      console.info('putParams: ', putParams);

      // write the user to the database
      try {
        const response = await dynamoDbUtils.call('put', putParams);

        console.info('putResponse: ', response);

        const msg = {
          to: data.email,
          from: 'email-validation@tannerrigby.com',
          templateId: constants.SENDGRID.EMAIL_VALIDATION_TEMPLATE_ID,
          dynamic_template_data: {
            dashboardUri: process.env.DASHBOARD_URI,
            emailValidationToken: user.emailValidationToken
          }
        };

        await mail.send(msg);

        const responseBody = {
          account: {
            email: user.email,
            id: user.userId,
            linkedEmail: [],
            name: user.name || ''
          },
          token: getJWT(user, constants.JWT.TYPES.USER)
        };

        return resolve(success(responseBody));
      } catch (err) {
        console.error('error saving the user in the database: ', err);
        return reject(
          serverFailure(
            'Server error creating the user in the database',
            err.response
          )
        );
      }
    });
  });
}
