
const logger = require('../loggers/log4js');
const {
    findThreadIds
} = require('./libs/mongoose.utils')

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
    logger.trace("TEST");
    let userId = actionsMsg.userId;
    let senderIds = actionsMsg.senderIds;
    senderIds.forEach((senderId) => {
        findThreadIds(userId, senderId, (err, res) => {
            logger.trace(res);
        })
    })
}

module.exports = actionsController;



