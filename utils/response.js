import _ from 'lodash';

export function success(body) {
  return buildResponse(_.get(body, 'statusCode', 200), body);
}

export function failure(statusCode, msg) {
  return buildResponse(statusCode, { error: msg || 'Error making server request' });
}

export function serverFailure(msg, err) {
  return buildResponse(500, { error: err ? err : 'Server error', message: msg});
}

function buildResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true
    },
    body: JSON.stringify(body)
  };
}
