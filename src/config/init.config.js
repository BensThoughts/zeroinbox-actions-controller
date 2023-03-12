module.exports = {
  MONGO_URI: String(process.env.MONGO_URI),
  // ACTIONS_HEALTH_HOST: String(process.env.ACTIONS_HEALTH_HOST),
  ACTIONS_HEALTH_PORT: Number(process.env.ACTIONS_HEALTH_PORT),
  GMAIL_BATCH_ENDPOINT: String(process.env.GMAIL_BATCH_ENDPOINT || 'https://www.googleapis.com/batch/gmail/v1'),
  GMAIL_BATCH_MODIFY_SIZE: Number(process.env.GMAIL_BATCH_MODIFY_SIZE || 1000),
  GMAIL_BATCH_MODIFY_ENDPOINT: String(process.env.GMAIL_BATCH_MODIFY_ENDPOINT || 'https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify'),
  BATCHELOR_BATCH_SIZE: Number(process.env.BATCHELOR_BATCH_SIZE || 1),
  // LOG_LEVEL: String(process.env.LOG_LEVEL || 'production'),
  GMAIL_LABEL_ENDPOINT: String(process.env.GMAIL_LABEL_ENDPOINT || 'https://www.googleapis.com/gmail/v1/users/me/labels'),
  GMAIL_MESSAGE_SEND_ENDPOINT: String(process.env.GMAIL_MESSAGE_SEND_ENDPOINT || 'https://www.googleapis.com/upload/gmail/v1/users/me/messages/send'),
  GMAIL_FILTER_ENDPOINT: String(process.env.GMAIL_FILTER_ENDPOINT || 'https://www.googleapis.com/gmail/v1/users/me/settings/filters'),
  GAPI_INIT_RETRY_DELAY: Number(process.env.GAPI_INIT_RETRY_DELAY || 500),
  GAPI_DELAY_MULTIPLIER: Number(process.env.GAPI_DELAY_MULTIPLIER || 2),
  GAPI_MAX_RETRIES: Number(process.env.GAPI_MAX_RETRIES || 3),
};
