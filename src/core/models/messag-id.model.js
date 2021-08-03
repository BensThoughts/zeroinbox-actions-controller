const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const messageIdSchema = new Schema({
  userId: {type: String, required: true},
  threadId: {type: String, required: true},
  messageId: {type: String, required: true},
});

const MessageId = mongoose.model('message-ids', messageIdSchema);

module.exports = MessageId;
