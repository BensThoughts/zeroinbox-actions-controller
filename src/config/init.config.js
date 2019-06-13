module.exports = {
    mongo_uri: process.env.MONGO_URI,
    actions_health_host: process.env.ACTIONS_HEALTH_HOST,
    actions_health_port: process.env.ACTIONS_HEALTH_PORT,
    GMAIL_BATCH_ENDPOINT: process.env.GMAIL_BATCH_ENDPOINT || 'https://www.googleapis.com/batch/gmail/v1',
    ACTIONS_BATCH_SIZE: process.env.ACTIONS_BATCH_SIZE || 50,
    log_level: process.env.LOG_LEVEL || 'production',
    GMAIL_LABEL_ENDPOINT: process.env.GMAIL_LABEL_ENDPOINT || 'https://www.googleapis.com/gmail/v1/users/me/labels',
    GMAIL_MESSAGE_SEND_ENDPOINT: process.env.GMAIL_MESSAGE_SEND_ENDPOINT || 'https://www.googleapis.com/upload/gmail/v1/users/me/messages/send',
    GAPI_INIT_RETRY_DELAY: Number(process.env.GAPI_INIT_RETRY_DELAY) || 500,
    GAPI_DELAY_MULTIPLIER: Number(process.env.GAPI_DELAY_MULTIPLIER) || 2,
    GAPI_MAX_RETRIES: Number(process.env.GAPI_MAX_RETRIES) || 3,
}