import bcrypt from 'bcryptjs';

import * as constants from '../constants';
import * as dynamoDbUtils from '../utils/dynamo';
import { failure, serverFailure, success } from '../utils/response';
import { getJWT } from '../utils/jwt';
import { isLambdaWarmer } from '../utils/warmer';
import { isEmailAddress } from '../models/user';

export async function main(event) {
  return new Promise(async (resolve, reject) => {
    if (isLambdaWarmer(event)) return resolve(success());

    const data = JSON.parse(event.body);

    if (!data.username || !data.password) {
      console.error('Invalid Request: missing required params');
      return reject(failure(400, 'Invalid Request: missing required params'));
    }

    const isEmail = isEmailAddress(data.username);
    let queryParams = {};

    if (isEmail) {
      queryParams = {
        TableName: constants.AWS.DYNAMO_USERS_TABLE,
        IndexName: 'primaryEmail-index',
        KeyConditionExpression: 'primaryEmail = :primaryEmail',
        ExpressionAttributeValues: dynamoDbUtils.getExpressionAttributeValues({
          primaryEmail: data.username
        })
      };
    } else if (!isEmail) {
      queryParams = {
        TableName: constants.AWS.DYNAMO_USERS_TABLE,
        IndexName: 'username-index',
        KeyConditionExpression: 'username = :username',
        ExpressionAttributeValues: dynamoDbUtils.getExpressionAttributeValues({
          username: data.username
        })
      };
    }

    // Make sure user exists
    dynamoDbUtils.call('query', queryParams)
      .then(results => {
        console.info('query results: ', results);

        const user = results.Items[0];

        if (!user) {
          // email not found in our db
          return reject(failure(400, 'incorrect username/password combination'));
        }

        // Check if the password is correct
        bcrypt.compare(data.password, user.password || 'fail', (err, res) => {
          if (err) {
            console.error(
              "error comparing the user's passwords: ",
              err.response
            );
            return reject(
              serverFailure(
                "Server error verifying user's password in the database",
                err.response
              )
            );
          }

          if (res) {
            // Passwords match
            // Delete the hashed password from the user obj so it's not returned to client
            delete user.password;

            return resolve(
              success({
                token: getJWT(user, constants.JWT.TYPES.USER),
                user
              })
            );
          }

          // Passwords don't match
          return reject(failure(400, 'incorrect username/password combination'));
        });
      })
      .catch(err => {
        console.error(
          'error querying for the user in the database: ',
          err.response
        );
        return reject(
          serverFailure(
            'Server error querying for the user in the database',
            err.response
          )
        );
      });
  });
}
