
const logger = require('../loggers/log4js');
const {
    findThreadIds,
    deleteSender,
    deleteThreadIds,
    unsubscribeSenderFromMongo,
    unlockActionsPipeline
} = require('./libs/mongoose.utils')

const {
    chunkThreadIds,
    createBatchTrashRequest,
    createBatchLabelRequest,
    asyncForEach
} = require('./libs/batch.utils');

const {
    httpPostLabelRequest,
    httpGetLabelsRequest,
    httpSendMessageRequest
} = require('./libs/api.utils');


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


    findThreadIds(userId, senderId, (err, threadIds) => {

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

          const startBatchProcess = async () => {
              let threadIdChunks = chunkThreadIds(threadIds, []);
  
              await asyncForEach(threadIdChunks, async (threadIdChunk) => {
                  let batchResult = await createBatchLabelRequest(threadIdChunk, access_token, labelId).catch((err) => {
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
              nackMessage(actionsMsg);
              logger.error(err);
          })
    

        }).catch((err) => {
            nackMessage(actionsMsg);
            logger.error(err)
        });
    })
}

function trashSender(actionsMsg) {
  let actionsObj = actionsMsg.content;

  let userId = actionsObj.userId;
  let access_token = actionsObj.access_token;
  let senderId = actionsObj.senderId;

  findThreadIds(userId, senderId, (err, threadIds) => {

    const startBatchProcess = async () => {
      let threadIdChunks = chunkThreadIds(threadIds, []);
      await asyncForEach(threadIdChunks, async (threadIdChunk) => {
          let batchResult = await createBatchTrashRequest(threadIdChunk, access_token).catch((err) => {
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
      nackMessage(actionsMsg);
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
      nackMessage(actionsMsg)
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
  let toIndex = unsubscribeEmail.search(/\.com/i);
  logger.trace(toIndex);
  to = unsubscribeEmail.slice(0, toIndex + 4);

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
  let actionsObj = actionsMsg.content;
  let userId = actionsObj.userId;

  // unlockActionsPipeline(userId, (unlockErr, unlockRes) => {
    rabbit.ack('actions.1', actionsMsg);
  // });
}


module.exports = actionsController;