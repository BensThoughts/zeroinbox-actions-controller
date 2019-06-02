module.exports = {
    mongo_uri: process.env.MONGO_URI,
    GMAIL_BATCH_ENDPOINT: process.env.GMAIL_BATCH_ENDPOINT || 'https://www.googleapis.com/batch/gmail/v1',
    ACTIONS_BATCH_SIZE: process.env.ACTIONS_BATCH_SIZE || '50',
    log_level: process.env.LOG_LEVEL || 'production',
    GMAIL_LABEL_ENDPOINT: process.env.GMAIL_LABEL_ENDPOINT || 'https://www.googleapis.com/gmail/v1/users/me/labels',
    GAPI_INIT_RETRY_DELAY: Number(process.env.GAPI_INIT_RETRY_DELAY) || 500,
    GAPI_DELAY_MULTIPLIER: Number(process.env.GAPI_DELAY_MULTIPLIER) || 2,
    GAPI_MAX_RETRIES: Number(process.env.GAPI_MAX_RETRIES) || 3,
}