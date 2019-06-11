
const logger = require('../loggers/log4js');
const {
    findThreadIds,
    deleteSender,
    deleteThreadIds,
} = require('./libs/mongoose.utils')

const {
    chunkThreadIds,
    createBatchTrashRequest,
    createBatchLabelRequest,
    asyncForEach
} = require('./libs/batch.utils');

const {
    httpPostLabelRequest,
    httpGetLabelsRequest
} = require('./libs/label.utils');


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
            logger.error('Action was not one of delete, label, or unsubscribe')
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

                rabbit.ack('actions.1', actionsMsg);

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
                rabbit.nack('actions.1', actionsMsg);
                logger.error(err);
            })
    

        }).catch((err) => {
            rabbit.nack('actions.1', actionsMsg);
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

                rabbit.ack('actions.1', actionsMsg);

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
                rabbit.nack('actions.1', actionsMsg);
                logger.error(error);
            })
        })
}

const { google } = require ('googleapis');
const Base64 = require('js-base64').Base64;
const request = require('request');

function unsubscribeSender(actionsMsg) {
  let actionsObj = actionsMsg.content;
  let userId = actionsObj.userId;
  let access_token = actionsObj.access_token;
  let senderId = actionsObj.senderId;
  let unsubscribeEmail = actionsObj.unsubscribeEmail;

  function makeBody(to, subject, message) {
    let str = ["to: ", to, "\n",
              // "from: ", from, "\n",
              "subject: ", subject, "\n\n",
              // message,
            ].join('');
    return str;
  }

  let metadata = {
    to: '',
    subject: ''
  }

  metadata = cleanSender(unsubscribeEmail);
  // checkForSubject(unsubscribeEmail);

  let raw = makeBody(metadata.to, metadata.subject);
  let option = {
    url: "https://www.googleapis.com/upload/gmail/v1/users/me/messages/send",
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'message/rfc822'
    },
    body: raw
  }

  request(option, (err, res, body) => {
    if (err) {
      logger.error(err);
    } else {
      logger.trace(body);
    }
    // logger.trace(res);
  });

  

  rabbit.ack('actions.1', actionsMsg);
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


module.exports = actionsController;