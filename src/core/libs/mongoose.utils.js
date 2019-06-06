const Sender = require('../models/sender.model');
const ThreadId = require('../models/Thread_ID.model');
const logger = require('../../loggers/log4js');

exports.findThreadIds = function findThreadIds(userId, senderId, callback) {
    let conditions = { 
        userId: userId,
        senderId: senderId
    }

    let projection = {
        threadIds: 1,
        _id: 0
    }

    Sender.findOne(conditions, projection, (err, res) => {
        if (err) {
            logger.error(err);
            return callback(err, res);
        }
        let threadIds = res.threadIds;
        callback(err, threadIds);
    });

    // Sender.find().distinct('threadIds', conditions, (senderError, res) => {
        // if (senderError) {
        //    return callback(senderError, null);
        // }
        // let threadIds = res;
        // let threadIdConditions = {
        //    userId: userId,
        //    threadId: {
        //        "$in": threadIds
        //    }
        // }
        // let projection = {
        //    'threadId': 1,
        //    _id: 0
        // }
        // ThreadId.find(threadIdConditions, projection, (err, threadIdsStillInInbox) => {
        //    threadIdsStillInInbox = threadIdsStillInInbox.map(threadIdsStillInInbox => threadIdsStillInInbox.threadId);
        //    callback(err, res);
        // });
    // })
}

exports.deleteSender = function deleteSender(userId, senderId, callback) {
    let conditions = {
        userId: userId,
        senderId: senderId
    }

    Sender.deleteOne(conditions, (err, res) => {
        callback(err, res);
    })
}

exports.deleteThreadIds = function deleteThreadIds(userId, threadIds, callback) {
    let conditions = {
        userId: userId,
        threadId: {
            "$in": threadIds
        }
    };
    
    ThreadId.deleteMany(conditions, (err, res) => {
        callback(err, res);
    })
}