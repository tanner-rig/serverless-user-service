import _ from 'lodash';
import axios from 'axios';

import { SERVICE_API_KEY, JWT, API_URL } from '../constants';
import { failure } from './response';
import { decode } from './jwt';
import { getOptions } from './request';

function finishProcesses() {
  return new Promise((resolve) => {
    setTimeout(() => { resolve(true); });
  });
}

async function deny(statusCode, reason, parentReject) {
  console.info(`${reason}!`);
  parentReject(failure(statusCode, reason));

  const processesFinished = await finishProcesses();

  if (processesFinished) process.exit(0);
}

/*
  * Check if a role is a required and if the user meets that role criteria
*/
function hasValidRole(acceptedRoles, role) {
  if (!acceptedRoles.length || (_.indexOf(acceptedRoles, role) > -1)) {
    return true;
  }

  return false;
}

/*
  * event: object - lambda event
  * reject: func - reject function from lambda to responsd to request if it fails
  * type: string - type off of the JWT (required if JWT auth is allowed)
  * acceptedRoles: array - accepted user roles to be authenticated (required if JWT auth is allowed)
*/
export async function requireAuth(event, parentReject, type = 'Invalid', acceptedRoles = []) {
  return new Promise(async (resolve) => {
    console.info('event: ', event);
    console.info('type: ', type);
    console.info('acceptedRoles: ', acceptedRoles);

    const serviceApiKey = _.get(event, 'headers[\'Service-API-Key\']');
    const token = _.get(event, 'headers.Authorization');

    if (serviceApiKey) {
      // API-key check
      if (serviceApiKey === SERVICE_API_KEY) {
        console.info('Is a valid service API key!');
        return resolve();
      }

      // Invalid Service API Key
      deny(401, 'Invalid service API key', parentReject);
    } else if (token) {
      // JWT Check
      try {
        if (!token.includes('Bearer')) {
          deny(401, 'Authorization header is missing "Bearer" before token', parentReject);
        }

        // Get decoded token and verify signature
        const decodedToken = decode(token.substring(7));

        if (decodedToken) {
          console.info('decodedToken: ', decodedToken);

          // Check if token is expired
          if (decodedToken.exp <= Math.floor(Date.now() / 1000)) {
            deny(401, 'Your JWT token has expired', parentReject);
          }

          // Check if user has necessary permissions
          if (decodedToken.type === JWT.TYPES.ADMIN) {
            console.info('Is a valid Admin!');
            return resolve();
          } else if (decodedToken.type === type && type === JWT.TYPES.COLLABORATOR) {
            const requestCollaboratorId = _.get(event, 'pathParameters.collaboratorId') || _.get(event, 'queryStringParameters.collaboratorId') || _.get(event, 'body.collaboratorId');
            let requestMerchantId = _.get(event, 'pathParameters.merchantId') || _.get(event, 'queryStringParameters.merchantId') || _.get(event, 'body.merchantId');

            if (requestCollaboratorId && requestCollaboratorId === decodedToken.sub) {
              // Collaborator making request is accessing/altering their own data
              return resolve();
            } else if (requestMerchantId && requestMerchantId === decodedToken.merchantId) {
              // Collaborator making request is trying to access/alter data on collaborator within their merchant account
              if (hasValidRole(acceptedRoles, decodedToken.role)) {
                // Collaborator's role is sufficient enough to make this request
                return resolve();
              }

              deny(403, 'Insufficient role to carry out this operation', parentReject);
            } else if (requestCollaboratorId && !requestMerchantId) {
              try {
                const options = getOptions();
                const requestUrl = `${API_URL}/collaborators/collaborator?collaboratorId=${requestCollaboratorId}`;
                const { data } = await axios.get(requestUrl, options);

                console.info('data: ', data);

                requestMerchantId = _.get(data, 'collaborator.merchantId', 'notfound');
              } catch (e) {
                console.error('server error getting collaborator: ', e);
                return deny(500, 'server error getting collaborator', parentReject);
              }

              if (decodedToken.merchantId === requestMerchantId) {
                // Collaborator making request is trying to access/alter data on collaborator within their merchant account
                if (hasValidRole(acceptedRoles, decodedToken.role)) {
                  // Collaborator's role is sufficient enough to make this request
                  return resolve();
                }

                deny(403, 'Insufficient role to carry out this operation', parentReject);
              } else {
                deny(403, 'Insufficient permissions to access accounts other than your own', parentReject);
              }
            } else {
              deny(403, 'Insufficient permissions to access accounts other than your own', parentReject);
            }
          } else if (decodedToken.type === type && type === JWT.TYPES.USER) {
            const requestUserId = _.get(event, 'pathParameters.userId') || _.get(event, 'queryStringParameters.userId') || _.get(event, 'body.userId');

            if (requestUserId && requestUserId === decodedToken.sub) {
              // User making request is accessing/altering their own data
              return resolve();
            }

            deny(403, 'Insufficient permissions to access accounts other than your own', parentReject);
          } else {
            deny(403, 'Unknown JWT type', parentReject);
          }
        } else {
          deny(401, 'Invalid JWT', parentReject);
        }
      } catch (e) {
        console.error('error decoding token: ', e);
        deny(401, 'JWT is not valid or has expired', parentReject);
      }
    } else {
      // No Authentication method found
      deny(401, 'Unauthorized!', parentReject);
    }
  });
}
