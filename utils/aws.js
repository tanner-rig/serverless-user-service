import AWS from 'aws-sdk';

import * as constants from '../constants';

// Configure AWS Region
AWS.config.update({ region: constants.AWS.REGION });

export default AWS;
