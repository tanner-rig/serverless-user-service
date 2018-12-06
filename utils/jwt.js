import jwt from 'jwt-simple';

import * as constants from '../constants';

export function getJWT(data, type) {
  // expiration date is 30 days from today
  const payload = {
    sub: data.userId,
    email: data.email,
    username: data.username || '',
    type,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor((Date.now() / 1000) + (60 * 60 * 24 * 30))
  };

  return jwt.encode(payload, constants.JWT.SECRET);
}

export function decode(token) {
  return jwt.decode(token, constants.JWT.SECRET);
}
