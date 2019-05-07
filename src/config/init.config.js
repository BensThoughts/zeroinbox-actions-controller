module.exports = {
    mongo_uri: process.env.MONGO_URI,
    GMAIL_BATCH_ENDPOINT: process.env.GMAIL_BATCH_ENDPOINT || 'https://www.googleapis.com/batch/gmail/v1',
    BATCH_SIZE: process.env.BATCH_SIZE || '100',
    log_level: process.env.LOG_LEVEL || 'production',
    DEFAULT_PERCENT_LOADED: process.env.DEFAULT_PERCENT_LOADED || 10
}