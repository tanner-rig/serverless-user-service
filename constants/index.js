export const AWS = {
  REGION: process.env.REGION || 'us-east-1',
  DYNAMO_USERS_TABLE: process.env.DYNAMO_USERS_TABLE || 'users-dev'
};

export const SENDGRID = {
  API_KEY: process.env.SENDGRID_API_KEY,
  API_URL: 'https://api.sendgrid.com/v3',
  USER_FORGOT_PASSWORD_TEMPLATE_ID: ''
};

export const SERVICE_API_KEY = process.env.SERVICE_API_KEY;

export const API_URL = process.env.API_URL;

export const JWT = {
  SECRET: process.env.JWT_SECRET,
  TYPES: {
    ADMIN: 'Admin',
    COLLABORATOR: 'Collaborator',
    USER: 'User'
  }
};

export const USER_STATUS = {
  ACTIVE: 'Active',
  DELETED: 'Deleted'
};
