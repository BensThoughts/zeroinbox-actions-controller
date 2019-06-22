const logger = require('../../loggers/log4js');

const Sender = require('../models/sender.model');
const MessageId = require('../models/messag-id.model');

exports.findSendersMessageIds = function findSendersMessageIds(userId, senderId, callback) {
    let conditions = { 
        userId: userId,
        senderId: senderId
    }

    let projection = {
        // threadIdsOriginating: 1,
        messageIds: 1,
        _id: 0
    }

    Sender.findOne(conditions, projection, (err, res) => {
        if (err) {
            logger.error(err);
            return callback(err, res);
        }
        if (res !== null) {
            // let threadIds = res.threadIdsOriginating;
            let messageIds = res.messageIds;
            callback(err, messageIds);
        } else {
            let errorMessage = userId + ' - Error finding senders in findSenderIds()';
            callback(errorMessage, [], []);
        }
    });
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

exports.deleteMessageIds = function deleteMessageIds(userId, messageIds, callback) {
  let conditions = {
      userId: userId,
      messageId: {
          "$in": messageIds
      }
  };
  
  MessageId.deleteMany(conditions, (err, res) => {
    callback(err, res);
  });
}

exports.unsubscribeSenderFromMongo = function unsubscribeSender(userId, senderId, callback) {
  let conditions = {
    userId: userId,
    senderId: senderId
  }

  let update = {
    unsubscribed: true
  }

  Sender.updateOne(conditions, update, (err, res) => {
    callback(err, res);
  })
}

exports.findSenderAddress = function(userId, senderId, callback) {
  let conditions = {
    userId: userId,
    senderId: senderId
  }
  let projection = {
    _id: 0,
    senderAddress: 1
  }

  Sender.findOne(conditions, projection, (err, res) => {
    if (res != null) {
      let senderAddress = res.senderAddress;
      callback(err, senderAddress);
    } else {
      let findError = 'senderId not found or no senderAddress at Sender.findOne() in findSenderAddress()';
      logger.error(findError);
      callback(findError, null);
    }
  })
}

/* exports.deleteThreadIds = function deleteThreadIds(userId, threadIds, callback) {
  let conditions = {
      userId: userId,
      threadId: {
          "$in": threadIds
      }
  };
  
  ThreadId.deleteMany(conditions, (err, res) => {
      callback(err, res);
  })
} */
