const Sender = require('../models/sender.model');
const ThreadId = require('../models/Thread_ID.model');
const logger = require('../../loggers/log4js');
const LoadingStatus = require('../models/loading.model');

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
        if (res !== null) {
            let threadIds = res.threadIds;
            callback(err, threadIds);
        } else {
            callback(null, []);
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
    let senderAddress = res.senderAddress;
    callback(err, senderAddress);
  })
}

exports.lockActionsPipeline = function(userId, callback) {
  let conditions = { userId: userId }
  let update = {
    actionsLock: true
  }
  LoadingStatus.updateOne(conditions, update, (err, res) => {
    callback(err, res);
  });
}

exports.unlockActionsPipeline = function(userId, callback) {
  let conditions = { userId: userId }
  let update = {
    actionsLock: false
  }
  LoadingStatus.updateOne(conditions, update, (err, res) => {
    callback(err, res);
  });
}

exports.checkActionsLock = function(userId, callback) {
  let conditions = { userId: userId }
  let projection = {
    actionsLock: 1,
    _id: 0
  }
  LoadingStatus.findOne(conditions, projection, (err, res) => {
    callback(err, res);
  });
}
