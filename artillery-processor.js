function logRequest(requestParams, context, ee, next) {
  console.log(`📤 Request: POST ${requestParams.url}`);
  return next();
}

function logResponse(requestParams, response, context, ee, next) {
  const status = response.statusCode;
  const emoji = status >= 200 && status < 300 ? '✅' : '❌';

  console.log(`${emoji} Response: ${status} - ${response.body || ''}`);
  return next();
}

module.exports = {
  logRequest,
  logResponse,
};
