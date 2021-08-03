// const logger = require('../../loggers/log4js');

const Sender = require('../models/sender.model');
const MessageId = require('../models/messag-id.model');

exports.findSendersMessageIds =
function findSendersMessageIds(userId, senderId, callback) {
  const conditions = {
    userId: userId,
    senderId: senderId,
  };

  const projection = {
    // threadIdsOriginating: 1,
    messageIds: 1,
    _id: 0,
  };

  Sender.findOne(conditions, projection, (err, res) => {
    if (err) return callback(err, res);

    if (res !== null) {
      // let threadIds = res.threadIdsOriginating;
      const messageIds = res.messageIds;
      callback(err, messageIds);
    } else {
      const errorMessage =
        userId + ' - Error finding senders in findSendersMessageIds';
      callback(errorMessage, [], []);
    }
  });
};

exports.deleteSender =
function deleteSender(userId, senderId, callback) {
  const conditions = {
    userId: userId,
    senderId: senderId,
  };

  Sender.deleteOne(conditions, (err, res) => {
    callback(err, res);
  });
};

exports.deleteMessageIds =
function deleteMessageIds(userId, messageIds, callback) {
  const conditions = {
    userId: userId,
    messageId: {
      '$in': messageIds,
    },
  };

  MessageId.deleteMany(conditions, (err, res) => {
    callback(err, res);
  });
};

exports.unsubscribeSenderFromMongo =
function unsubscribeSender(userId, senderId, callback) {
  const conditions = {
    userId: userId,
    senderId: senderId,
  };

  const update = {
    unsubscribed: true,
  };

  Sender.updateOne(conditions, update, (err, res) => {
    callback(err, res);
  });
};

exports.findSenderAddress = function(userId, senderId, callback) {
  const conditions = {
    userId: userId,
    senderId: senderId,
  };

  const projection = {
    _id: 0,
    senderAddress: 1,
  };

  Sender.findOne(conditions, projection, (err, res) => {
    if (res != null) {
      const senderAddress = res.senderAddress;
      callback(err, senderAddress);
    } else {
      const findError =
        'senderId not found or no senderAddress in findSenderAddress()';
      callback(findError, null);
    }
  });
};
