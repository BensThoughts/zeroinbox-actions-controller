/*******************************************************************************
 * MONGODB INIT
 ******************************************************************************/
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const threadIdSchema = new Schema({
  userId: { type: String, required: true },
  threadId: { type: String, required: true },
  snippet: { type: String, required: false },
  historyId: { type: String, required: false },
  senderId: { type: String, require: false },
});

const ThreadId = mongoose.model('Thread-Ids', threadIdSchema);

module.exports = ThreadId;
