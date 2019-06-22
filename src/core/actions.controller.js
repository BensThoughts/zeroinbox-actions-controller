
const logger = require('../loggers/log4js');
const {
    findSendersMessageIds,
    deleteSender,
    deleteMessageIds,
    unsubscribeSenderFromMongo,
    findSenderAddress,
} = require('./libs/mongoose.utils')

const {
    chunkIds,
    createBatchTrashRequest,
    createBatchLabelRequest,
    asyncForEach
} = require('./libs/batch.utils');

const {
    httpCreateLabelRequest,
    httpGetLabelsRequest,
    httpSendMessageRequest,
    httpCreateFilterRequest
} = require('./libs/api.utils');

const {
  GMAIL_BATCH_MODIFY_SIZE,
  BATCHELOR_BATCH_SIZE
} = require('../config/init.config');

const {
  rabbit_topology
} = require('../config/rabbit.config')


const rabbit = require('zero-rabbit');


function actionsController(actionsMsg) {

    let actionType = actionsMsg.content.actionType;

    switch(actionType) {

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
            logger.error('Action was not one of delete, label, or unsubscribe');
            ackMessage(actionsMsg);
    }
 
}

function labelSender(actionsMsg) {
  let actionsObj = actionsMsg.content;

  let userId = actionsObj.userId;
  let access_token = actionsObj.access_token;
  let senderId = actionsObj.senderId;


  findSendersMessageIds(userId, senderId, (err, messageIds) => {
      if (err) {
        logger.error(err);
        ackMessage(actionsMsg);
      } else {
        httpGetLabelsRequest(access_token).then( async (labelsResponse) => {
          let categoryLabelName = actionsObj.category;
          let categoryLabelId = '';
          let userLabelName = actionsObj.labelName;
          let userLabelId = '';
          let labelIds = [];

          if (categoryLabelName != 'NO_CATEGORY') {
            userLabelName = categoryLabelName + '/' + userLabelName

            let categoryLabelIndex = labelsResponse.labels.findIndex((label) => {
              return label.name === categoryLabelName;
            });
              
            if (categoryLabelIndex === -1) {
              await httpCreateLabelRequest(access_token, categoryLabelName).then((categoryLabelResponse) => {
                categoryLabelId = categoryLabelResponse.id;
                logger.trace(userId + ' - Label Created: ' + categoryLabelResponse);
              }).catch((err) => logger.error(userId + ' - Error: ' + err));
            } else {
              categoryLabelId = labelsResponse.labels[categoryLabelIndex].id;
            }

            labelIds = labelIds.concat(categoryLabelId);
          }
  
          let userLabelIndex = labelsResponse.labels.findIndex((label) => {
            return label.name === userLabelName;
          });
          if (userLabelIndex === -1) {
            await httpCreateLabelRequest(access_token, userLabelName).then((userLabelResponse) => {
              userLabelId = userLabelResponse.id;
              logger.trace(userId + ' - Label Created: ' + userLabelResponse);
            }).catch((err) => logger.error(err));
          } else {
            userLabelId = labelsResponse.labels[userLabelIndex].id;
          }

          labelIds = labelIds.concat(userLabelId);

          let filter = actionsObj.filter;
          if (filter) {
            createFilters(userId, access_token, labelIds, senderId);
          }

          const startBatchProcess = async () => {
              let messageIdChunks = chunkIds(messageIds, [], GMAIL_BATCH_MODIFY_SIZE);
              let batchChunks = chunkIds(messageIdChunks, [], BATCHELOR_BATCH_SIZE); // for safety just do one item batches

              await asyncForEach(batchChunks, async (batchChunk) => {
                  let batchResult = await createBatchLabelRequest(batchChunk, access_token, labelIds).catch((err) => {
                      logger.error(err);
                  });
                  logger.trace(userId + ' - Batch Label Results: ' + JSON.stringify(batchResult));
              });
  
              ackMessage(actionsMsg);
              deleteSender(userId, senderId, (err, res) => {
                if (err) return logger.error(err);
                logger.trace(userId + ' - Sender deleted: ' + senderId);
              });
  
              deleteMessageIds(userId, messageIds, (err, res) => {
                if (err) return logger.error(userId + ' - ' + err);
                logger.trace(userId + ' - Message Ids deleted: ' + messageIds.length);
              });
          }
  
          startBatchProcess().catch((err) => {
              ackMessage(actionsMsg);
              logger.error(err);
          })
    
  
        }).catch((err) => {
            ackMessage(actionsMsg);
            logger.error(err)
        });
      }
    
  })
}

function createFilters(userId, access_token, labelIds, senderId) {
  findSenderAddress(userId, senderId, (err, senderAddress) => {
    if (err) return logger.error(userId + ' - ' + err);
    labelIds.forEach((labelId) => {
      httpCreateFilterRequest(access_token, labelId, senderAddress).then((response) => {
        logger.trace(userId + ' - Filter created response: ' + JSON.stringify(response));
      }).catch((err) => {
        logger.error(userId + ' - ' + err);
      });
    });
  });
}

function trashSender(actionsMsg) {
  let actionsObj = actionsMsg.content;

  let userId = actionsObj.userId;
  let access_token = actionsObj.access_token;
  let senderId = actionsObj.senderId;

  findSendersMessageIds(userId, senderId, (err, messageIds) => {

    const startBatchProcess = async () => {
      let messageIdChunks = chunkIds(messageIds, [], GMAIL_BATCH_MODIFY_SIZE);
      let batchChunks = chunkIds(messageIdChunks, [], BATCHELOR_BATCH_SIZE);
      await asyncForEach(batchChunks, async (batchChunk) => {
          let batchResult = await createBatchTrashRequest(batchChunk, access_token).catch((err) => {
              logger.error(userId + ' - ' + err);
          });
          logger.trace(userId + ' - Batch Trash Results: ' + JSON.stringify(batchResult));
      });

      ackMessage(actionsMsg);

      deleteSender(userId, senderId, (err, res) => {
          if (err) return logger.error(userId + ' - ' + err);
          logger.trace(userId + ' - Sender deleted: ' + senderId);
      });

      deleteMessageIds(userId, messageIds, (err, res) => {
          if (err) return logger.error(userId + ' - ' + err);
          logger.trace(userId + ' - Message Ids deleted: ' + messageIds.length);
      });
    }

    startBatchProcess().catch(error => {
      ackMessage(actionsMsg);
      logger.error(error);
    });
  });
}

async function unsubscribeSender(actionsMsg) {
  let actionsObj = actionsMsg.content;
  let userId = actionsObj.userId;
  let access_token = actionsObj.access_token;
  let senderId = actionsObj.senderId;
  let unsubscribeEmail = actionsObj.unsubscribeEmail;
  let unsubscribeWeb = actionsObj.unsubscribeWeb;

  if (unsubscribeEmail) {
    let metadata = {
      to: '',
      subject: ''
    }
    metadata = cleanSender(unsubscribeEmail);    

    httpSendMessageRequest(access_token, metadata.to, metadata.subject).then((response) => {
      unsubscribeSenderFromMongo(userId, senderId, (err, mongoResponse) => {
        if (err) logger.error(userId + ' - ' + err);
        logger.trace(userId + ' - Unsubscribe Sender From Mongo: ' + senderId);
      });
      ackMessage(actionsMsg);
    }).catch((error) => {
      ackMessage(actionsMsg)
    });

  } else {
    unsubscribeSenderFromMongo(userId, senderId, (err, response) => {
      if (err) return logger.error(userId + ' - ' + err);
      logger.trace(userId + ' - Unsubscribe Sender From Mongo: ' + senderId);
    });
    ackMessage(actionsMsg);
  }
}

function cleanSender(unsubscribeEmail) {
  let to = '';
  let subject = '';

  // clean off any mailto: (should usually be index 0 to 7)
  let mailtoIndex = unsubscribeEmail.search('mailto:');
  if (mailtoIndex != -1) {
    unsubscribeEmail = unsubscribeEmail.slice(mailtoIndex + 7);
  }

  // find the .com and get the sender (should be 0 to the end of .com)
  // let toIndex = unsubscribeEmail.search(/\.com/i);
  // logger.trace(toIndex);
  // to = unsubscribeEmail.slice(0, toIndex + 4);

  // find out if there is a subject query line (should be ?subject='' and should come right after .com)
  let subjectIndex = unsubscribeEmail.search(/\?subject=/i);


  if (subjectIndex != -1) {
    subject = unsubscribeEmail.slice(subjectIndex + 9);
    to = unsubscribeEmail.slice(0, subjectIndex);
  } else {
    to = unsubscribeEmail;
  }

  logger.trace('To: ' + to);
  logger.trace('Subject: ' + subject);

  return {
    to: to,
    subject: subject
  }

}

function ackMessage(actionsMsg) {
  let userId = actionsMsg.content.userId;
  rabbit.ack(rabbit_topology.channels.listen, actionsMsg);
  logger.trace(userId + ' - Actions Message Acked: ' + JSON.stringify(actionsMsg.content));
}


module.exports = actionsController;