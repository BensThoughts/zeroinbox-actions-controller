
const logger = require('../loggers/log4js');
const {
  findSendersMessageIds,
  deleteSender,
  deleteMessageIds,
  unsubscribeSenderFromMongo,
  findSenderAddress,
} = require('./libs/mongoose.utils');

const {
  chunkIds,
  createBatchTrashRequest,
  createBatchLabelRequest,
  asyncForEach,
} = require('./libs/batch.utils');

const {
  httpCreateLabelRequest,
  httpGetLabelsRequest,
  httpSendMessageRequest,
  httpCreateFilterRequest,
} = require('./libs/api.utils');

const {
  GMAIL_BATCH_MODIFY_SIZE,
  BATCHELOR_BATCH_SIZE,
} = require('../config/init.config');

const {
  userTopology,
} = require('../config/rabbit.config');


const rabbit = require('zero-rabbit');

/**
 * @param  {RabbitMsg} actionsMsg
 */
function actionsController(actionsMsg) {
  const actionType = actionsMsg.content.actionType;

  switch (actionType) {
    case 'delete':
      trashSender(actionsMsg);
      return;

    case 'label':
      labelSender(actionsMsg);
      return;

    case 'unsubscribe':
      unsubscribeSender(actionsMsg);
      return;

    default:
      logger.error('Action was not 1 of delete/label/unsubscribe');
      ackMessage(actionsMsg);
  }
}

/**
 * @param  {RabbitMsg} actionsMsg
 */
function labelSender(actionsMsg) {
  const actionsObj = actionsMsg.content;

  const userId = actionsObj.userId;
  const accessToken = actionsObj.accessToken;
  const senderId = actionsObj.senderId;


  findSendersMessageIds(userId, senderId, (mongoErr, messageIds) => {
    if (mongoErr) {
      logger.error(mongoErr);
      ackMessage(actionsMsg);
    } else {
      httpGetLabelsRequest(accessToken).then( async (labelsResponse) => {
        const categoryLabelName = actionsObj.category;
        let categoryLabelId = '';
        let userLabelName = actionsObj.labelName;
        let userLabelId = '';
        let labelIds = [];

        if (categoryLabelName != 'NO_CATEGORY') {
          userLabelName = categoryLabelName + '/' + userLabelName;

          const categoryLabelIndex =
          labelsResponse.labels.findIndex((label) => {
            return label.name.toLowerCase() === categoryLabelName.toLowerCase();
          });

          if (categoryLabelIndex === -1) {
            await httpCreateLabelRequest(
                accessToken,
                categoryLabelName,
            ).then((categoryLabelResponse) => {
              categoryLabelId = categoryLabelResponse.id;
              logger.trace('Label Created Response: ' +
                JSON.stringify(categoryLabelResponse));
            }).catch((httpErr) => {
              return logger
                  .error(userId + ' - Error: ' + JSON.stringify(httpErr));
            });
          } else {
            categoryLabelId = labelsResponse.labels[categoryLabelIndex].id;
          }

          labelIds = labelIds.concat(categoryLabelId);
        }

        const userLabelIndex = labelsResponse.labels.findIndex((label) => {
          return label.name.toLowerCase() === userLabelName.toLowerCase();
        });

        if (userLabelIndex === -1) {
          await httpCreateLabelRequest(
              accessToken,
              userLabelName,
          ).then((userLabelResponse) => {
            userLabelId = userLabelResponse.id;
            logger.trace('Label Created: ' + userLabelResponse);
          }).catch((httpErr) => {
            return logger.error('Error: ' + JSON.stringify(httpErr));
          });
        } else {
          userLabelId = labelsResponse.labels[userLabelIndex].id;
        }

        labelIds = labelIds.concat(userLabelId);

        const filter = actionsObj.filter;

        if (filter) {
          createFilters(userId, accessToken, labelIds, senderId);
        }

        const startBatchProcess = async () => {
          // for safety just do one item batches
          const messageIdChunks = chunkIds(
              messageIds, [], GMAIL_BATCH_MODIFY_SIZE);
          const batchChunks = chunkIds(
              messageIdChunks, [], BATCHELOR_BATCH_SIZE);

          await asyncForEach(batchChunks, async (batchChunk) => {
            const batchResult = await createBatchLabelRequest(
                batchChunk,
                accessToken,
                labelIds,
            ).catch((batchErr) => {
              logger.error(JSON.stringify(batchErr));
            });
            const logResult = JSON.stringify(batchResult);
            logger.trace('Batch Label Results: ' + logResult);
          });

          ackMessage(actionsMsg);
          deleteSender(userId, senderId, (mongoErr, res) => {
            if (mongoErr) return logger.error(mongoErr);
            logger.trace('Sender deleted: ' + senderId);
          });

          deleteMessageIds(userId, messageIds, (mongoErr, res) => {
            if (mongoErr) return logger.error(mongoErr);
            logger.trace('Message Ids deleted: ' + messageIds.length);
          });
        };

        startBatchProcess().catch((batchErr) => {
          ackMessage(actionsMsg);
          logger.error('Error: ' + JSON.stringify(batchErr));
        });
      }).catch((httpErr) => {
        ackMessage(actionsMsg);
        logger.error('Error: ' + JSON.stringify(httpErr));
      });
    }
  });
}

/**
 * @param  {string} userId
 * @param  {string} accessToken
 * @param  {Array<string>} labelIds
 * @param  {string} senderId
 */
function createFilters(userId, accessToken, labelIds, senderId) {
  findSenderAddress(userId, senderId, (mongoErr, senderAddress) => {
    if (mongoErr) return logger.error(mongoErr);
    labelIds.forEach((labelId) => {
      httpCreateFilterRequest(accessToken, labelId, senderAddress)
          .then((response) => {
            const logResponse = JSON.stringify(response);
            logger.trace('Filter created response: ' + logResponse);
          }).catch((httpErr) => {
            logger.error(JSON.stringify(httpErr));
          });
    });
  });
}

/**
 * @param  {RabbitMsg} actionsMsg
 */
function trashSender(actionsMsg) {
  const actionsObj = actionsMsg.content;

  const userId = actionsObj.userId;
  const accessToken = actionsObj.accessToken;
  const senderId = actionsObj.senderId;

  findSendersMessageIds(userId, senderId, (mongoErr, messageIds) => {
    if (mongoErr) return logger.error(mongoError);
    const startBatchProcess = async () => {
      const messageIdChunks = chunkIds(messageIds, [], GMAIL_BATCH_MODIFY_SIZE);
      const batchChunks = chunkIds(messageIdChunks, [], BATCHELOR_BATCH_SIZE);
      await asyncForEach(batchChunks, async (batchChunk) => {
        const batchResult = await createBatchTrashRequest(
            batchChunk,
            accessToken,
        ).catch((batchErr) => {
          logger.error(batchErr);
        });
        const logResults = JSON.stringify(batchResult);
        logger.trace('Batch Trash Results: ' + logResults);
      });

      ackMessage(actionsMsg);

      deleteSender(userId, senderId, (mongoErr, res) => {
        if (mongoErr) return logger.error(mongoErr);
        logger.trace('Sender deleted: ' + senderId);
      });

      deleteMessageIds(userId, messageIds, (mongoErr, res) => {
        if (mongoErr) return logger.error(mongoErr);
        logger.trace('Message Ids deleted: ' + messageIds.length);
      });
    };

    startBatchProcess().catch((batchError) => {
      ackMessage(actionsMsg);
      logger.error(batchError);
    });
  });
}

/**
 * @param  {RabbitMsg} actionsMsg
 */
async function unsubscribeSender(actionsMsg) {
  const actionsObj = actionsMsg.content;
  const userId = actionsObj.userId;
  const accessToken = actionsObj.accessToken;
  const senderId = actionsObj.senderId;
  const unsubscribeEmail = actionsObj.unsubscribeEmail;
  // const unsubscribeWeb = actionsObj.unsubscribeWeb;

  if (unsubscribeEmail) {
    let metadata = {
      to: '',
      subject: '',
    };
    metadata = cleanSender(unsubscribeEmail);

    httpSendMessageRequest(accessToken, metadata.to, metadata.subject)
        .then((response) => {
          const logMetaData = JSON.stringify(metadata);
          logger.trace('Sent Unsubscribe Request: ' + logMetaData);
          unsubscribeSenderFromMongo(
              userId,
              senderId,
              (mongoErr, mongoResponse) => {
                if (mongoErr) logger.error(mongoErr);
                logger.trace('Unsubscribe Sender From Mongo: ' + senderId);
              });
          ackMessage(actionsMsg);
        }).catch((httpError) => {
          logger.error(JSON.stringify(httpError));
          ackMessage(actionsMsg);
        });
  } else {
    unsubscribeSenderFromMongo(userId, senderId, (mongoErr, response) => {
      if (mongoErr) return logger.error(mongoErr);
      logger.trace('Unsubscribe Sender From Mongo: ' + senderId);
    });
    ackMessage(actionsMsg);
  }
}

/**
 * Cleanup broken addresses
 * @param  {string} unsubscribeEmail
 * @return {Object} {to: string, subject: string}
 */
function cleanSender(unsubscribeEmail) {
  let to = '';
  let subject = '';

  // clean off any mailto: (should usually be index 0 to 7)
  const mailtoIndex = unsubscribeEmail.search('mailto:');
  if (mailtoIndex != -1) {
    unsubscribeEmail = unsubscribeEmail.slice(mailtoIndex + 7);
  }

  // find out if there is a subject query line
  // (should be ?subject='' and should come right after .com, .net, ..etc.)
  const subjectIndex = unsubscribeEmail.search(/\?subject=/i);

  if (subjectIndex != -1) {
    subject = unsubscribeEmail.slice(subjectIndex + 9);
    to = unsubscribeEmail.slice(0, subjectIndex);
  } else {
    to = unsubscribeEmail;
  }

  return {
    to: to,
    subject: subject,
  };
}
/**
 * @param  {RabbitMsg} actionsMsg
 */
function ackMessage(actionsMsg) {
  logger.trace('Actions Message Acked!');
  rabbit.ack(userTopology.channels.listen, actionsMsg);
}

module.exports = actionsController;
