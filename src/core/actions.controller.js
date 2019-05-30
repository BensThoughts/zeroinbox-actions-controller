
const logger = require('../loggers/log4js');
const {
    findThreadIds
} = require('./libs/mongoose.utils')

const {
    chunkThreadIds,
    createBatchTrashRequest,
    asyncForEach
} = require('./libs/batch.utils');

/*******************************************************************************
 BATCHELOR INIT
*******************************************************************************/


function actionsController(actionsMsg) {

    switch(actionsMsg.actionType) {
        case 'delete':
            deleteSenders(actionsMsg);
            return;
        default:
            logger.error('Action was not one of delete, label, or unsubscribe')
    }
 
}

function deleteSenders(actionsMsg) {
    let userId = actionsMsg.userId;
    let access_token = actionsMsg.access_token;
    let senderIds = actionsMsg.senderIds;
    senderIds.forEach((senderId) => {
        findThreadIds(userId, senderId, (err, res) => {
            logger.trace(res);
            const startBatchProcess= async () => {
                let threadIdChunks = chunkThreadIds(res, []);
                await asyncForEach(threadIdChunks, async (threadIdChunk) => {
                    let batchResult = await createBatchTrashRequest(threadIdChunk, access_token).catch((err) => {
                        logger.error(err);
                    });
                    logger.trace(batchResult);
                })
            }

            startBatchProcess().catch(error => {
                logger.error(error);
            })
        })
    })
}

module.exports = actionsController;



