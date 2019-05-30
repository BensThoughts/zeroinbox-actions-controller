const Sender = require('../models/sender.model');
const logger = require('../../loggers/log4js');

exports.findThreadIds = function findThreadIds(userId, senderId, callback) {
    let conditions = { 
        userId: userId,
        senderId: senderId
    }

    Sender.find().distinct('threadIds_internalDates.threadId', conditions, (err, res) => {
        callback(err, res);
    })
}