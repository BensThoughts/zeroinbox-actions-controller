
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
                logger.error(err);
            })
    

        }).catch((err) => logger.error(err));
    })
}

function trashSender(actionsMsg) {
    let actionsObj = actionsMsg.content;

    let userId = actionsObj.userId;
    let access_token = actionsObj.access_token;
    let senderId = actionsObj.senderId;

    findThreadIds(userId, senderId, (err, res) => {
            let threadIds = res;

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
                logger.error(error);
            })
        })
}

module.exports = actionsController;