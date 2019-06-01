
const logger = require('../loggers/log4js');
const {
    findThreadIds,
    deleteSender,
    deleteThreadIds,
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

        case 'label':
            logger.trace('RABBIT LABEL MESSAGE');
            logger.trace(actionsMsg)
            return;

        default:
            logger.error('Action was not one of delete, label, or unsubscribe')
    }
 
}

async function deleteSenders(actionsMsg) {
    let userId = actionsMsg.userId;
    let access_token = actionsMsg.access_token;
    let senderIds = actionsMsg.senderIds;
    
    await asyncForEach(senderIds, async (senderId) => {
        await findThreadIds(userId, senderId, async (err, res) => {
            const startBatchProcess= async () => {
                let threadIdChunks = chunkThreadIds(res, []);
                await asyncForEach(threadIdChunks, async (threadIdChunk) => {
                    let batchResult = await createBatchTrashRequest(threadIdChunk, access_token).catch((err) => {
                        logger.error(err);
                    });
                    logger.trace(batchResult);
                    deleteSender(userId, senderId, (err, res) => {
                        if (err) {
                            return logger.error(err);
                        }
                        logger.trace(res);
                    });
                })
            }

            await startBatchProcess().catch(error => {
                logger.error(error);
            })
        })
    })
    // senderIds.forEach((senderId) => {
    
    //})
}

module.exports = actionsController;



