
const logger = require('../loggers/log4js');
const {
    findSenderIds,
    deleteSender,
    deleteThreadIds,
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
    httpPostLabelRequest,
    httpGetLabelsRequest,
    httpSendMessageRequest,
    httpPostFilterRequest
} = require('./libs/api.utils');

const {
  GMAIL_BATCH_MODIFY_SIZE,
  BATCHELOR_BATCH_SIZE
} = require('../config/init.config');


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
  let category = actionsObj.category;
  let labelName = actionsObj.labelName;

  let filter = actionsObj.filter;



  findSenderIds(userId, senderId, (err, threadIds, messageIds) => {
      if (err) {
        logger.error(err);
        ackMessage(actionsMsg);
      } else {

        httpGetLabelsRequest(access_token).then( async (response) => {
          let labelId;
  
          let labelNames = response.labels.map(label => label.name);
  
          let categoryExists = labelNames.includes(category);
  
          if (category != 'NO_CATEGORY') {
              labelName = category + '/' + labelName;
              if (!categoryExists) {
                  await httpPostLabelRequest(access_token, category).catch((err) => logger.error(err));
              }
          }
  
          let labelNameExists = labelNames.includes(labelName);
  
          if (!labelNameExists) {
            await httpPostLabelRequest(access_token, labelName).then((response) => {
              labelId = response.id;
            }).catch((err) => logger.error(err));
          } else {
            labelId = response.labels.find((element, index, array) => {
              return element.name === labelName;
            }).id;
          }
          
          if (filter) {
            createFilter(userId, access_token, labelId, senderId);
          }
  
          const startBatchProcess = async () => {
              let messageIdChunks = chunkIds(messageIds, [], GMAIL_BATCH_MODIFY_SIZE);
              let batchChunks = chunkIds(messageIdChunks, [], BATCHELOR_BATCH_SIZE); // for safety just do one item batches

              await asyncForEach(batchChunks, async (batchChunk) => {
                  let batchResult = await createBatchLabelRequest(batchChunk, access_token, labelId).catch((err) => {
                      logger.error(err);
                  });
                  logger.trace(batchResult);
              });
  
              ackMessage(actionsMsg);
              deleteSender(userId, senderId, (err, res) => {
                  if (err) {
                      return logger.error(err);
                  }
              });
  
              deleteThreadIds(userId, threadIds, (err, res) => {
                  if (err) {
                      return logger.error(err);
                  }
                  logger.trace(res);
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

function createFilter(userId, access_token, labelId, senderId) {
  findSenderAddress(userId, senderId, (err, senderAddress) => {
    if (err) {
      return logger.error(err);
    } else {
      httpPostFilterRequest(access_token, labelId, senderAddress).then((response) => {
        logger.trace('filters response: ' + JSON.stringify(response));
      }).catch((err) => {
        logger.error(err);
      });
    }
  });
}

function trashSender(actionsMsg) {
  let actionsObj = actionsMsg.content;

  let userId = actionsObj.userId;
  let access_token = actionsObj.access_token;
  let senderId = actionsObj.senderId;

  findSenderIds(userId, senderId, (err, threadIds, messageIds) => {

    const startBatchProcess = async () => {
      let messageIdChunks = chunkIds(messageIds, [], GMAIL_BATCH_MODIFY_SIZE);
      let batchChunks = chunkIds(messageIdChunks, [], BATCHELOR_BATCH_SIZE);
      await asyncForEach(batchChunks, async (batchChunk) => {
          let batchResult = await createBatchTrashRequest(batchChunk, access_token).catch((err) => {
              logger.error(err);
          });
          logger.trace(batchResult);
      })

      ackMessage(actionsMsg);

      deleteSender(userId, senderId, (err, res) => {
          if (err) {
              return logger.error(err);
          }
          logger.trace(res);
      });

      deleteThreadIds(userId, threadIds, (err, res) => {
          if (err) {
              return logger.error(err);
          }
          logger.trace(res);
      });
    }

    startBatchProcess().catch(error => {
      ackMessage(actionsMsg);
      logger.error(error);
    });
  });
}

function unsubscribeSender(actionsMsg) {
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
        if (err) {
          logger.error(err);
        } else {
          logger.trace('unsubscribeSenderFromMongo: ' + mongoResponse);
        }
      });
      ackMessage(actionsMsg);
    }).catch((error) => {
      ackMessage(actionsMsg)
    });
  } else {
    unsubscribeSenderFromMongo(userId, senderId, (err, response) => {
      if (err) {
        logger.error(err);
      } else {
        logger.trace('unsubscribeSenderFromMongo: ' + response);
      }
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

function nackMessage(actionsMsg) {
  rabbit.nack('actions.1', actionsMsg);
}

function ackMessage(actionsMsg) {
  rabbit.ack('actions.1', actionsMsg);
}


module.exports = actionsController;