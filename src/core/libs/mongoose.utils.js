const Sender = require('../models/sender.model');

exports.findThreadIds = function findThreadIds(userId, senderId, callback) {
    let conditions = { 
        userId: userId,
        senderId: senderId
    }

    let projection = {
        _id: 0,
        "threadIds_internalDates": 1
    }

    Sender.findOne(conditions, projection, (err, res) => {
        callback(err, res);
    })
}