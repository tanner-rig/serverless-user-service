import _ from 'lodash';

const user = {
  userId: '',
  primaryEmail: '',
  username: '',
  password: '',
  name: '',
  phone: '',
  status: '',
  emailValidationToken: '',
  emailValidationExpiration: '',
  resetPasswordToken: '',
  resetPasswordExpiration: '',
  emailVerified: '',
  createdAt: '',
  updatedAt: ''
};

function getUserKeys() {
  return Object.keys(user);
}

export function getUserKeysWithoutSecrets() {
  const userKeys = getUserKeys();

  return _.remove(userKeys, value => {
    return (
      value !== 'password' &&
      value !== 'resetPasswordToken' &&
      value !== 'resetPasswordExpiration' &&
      value !== 'emailValidationToken' &&
      value !== 'emailValidationExpiration'
    );
  });
}

export function getUser(data) {
  const userKeys = getUserKeys();
  const prunedData = _.cloneDeep(data);

  _.forIn(data, (value, key) => {
    // check if key exists on User object
    const index = _.indexOf(userKeys, key);

    if (index < 0) {
      // It doesn't exist, don't allow it to be added to db
      delete prunedData[key];
    } else if (!value) {
      // No value, delete it
      delete prunedData[key];
    }
  });

  return prunedData;
}

export function getUniqueValidationToken() {
  const chars = '0123456789';
  const stringLength = 6;
  let randomString = '';
  for (let i = 0; i < stringLength; i++) {
    let rnum = Math.floor(Math.random() * chars.length);
    randomString += chars.substring(rnum, rnum + 1);
  }

  return randomString;
}

export function isEmailAddress(username) {
  const emailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return emailRegex.test(username);
}
