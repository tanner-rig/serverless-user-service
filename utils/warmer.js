module.exports.isLambdaWarmer = function(event) {
  /** Immediate response for WarmUP plugin */
  if (event.source === 'serverless-plugin-warmup') {
    console.info('WarmUP - Lambda is warm!');
    return true;
  }
};
