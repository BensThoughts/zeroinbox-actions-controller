
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
    GMAIL_LABEL_ENDPOINT
} = require('../config/init.config');

const request = require('request');

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

function createLabel(userId, access_token, labelName) {

}

function labelSender(actionsMsg) {
    let actionsObj = actionsMsg.content;

    let userId = actionsObj.userId;
    let access_token = actionsObj.access_token;
    let senderId = actionsObj.senderId;
    let category = actionsObj.category;
    let labelName = actionsObj.labelName;

    let label = labelName;

    findThreadIds(userId, senderId, (err, res) => {

        let threadIds = res;
        
        const options = {
            url: GMAIL_LABEL_ENDPOINT,
            headers: {
              'Authorization': 'Bearer ' + access_token
            },
            body: {
                labelListVisibility: 'labelShow',
                messageListVisibility: 'show',
                name: label
            },
            json: true
          };

        request.post(options, async (err, response, body) => {
            if (err) {
                logger.error(err);
            }
            // logger.trace(response);
            logger.trace(body);

            let labelId = body.id;

            const startBatchProcess = async () => {
                let threadIdChunks = chunkThreadIds(threadIds, []);
    
                await asyncForEach(threadIdChunks, async (threadIdChunk) => {
                    let batchResult = await createBatchLabelRequest(threadIdChunk, access_token, labelId).catch((err) => {
                        logger.error(err);
                    });
                    logger.trace(batchResult);
                    // logger.trace(batchResult.parts[0].body.error.errors);
                });

                rabbit.ack('actions.1', actionsMsg);

                deleteSender(userId, senderId, (err, res) => {
                    if (err) {
                        return logger.error(err);
                    }
                    // logger.trace(res);
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



        })

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



