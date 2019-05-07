const mongoose = require('mongoose');
const logger = require('./loggers/log4js');

const rabbit = require('zero-rabbit');

const actionsController = require('./core/actions.controller');

const { mongo_uri } = require('./config/init.config');
const { rabbit_config } = require('./config/rabbit.config')

mongoose.connect(mongo_uri, { useNewUrlParser: true }, (err, db) => {
  if (err) {
    logger.error('Error at mongoose.connect(): ' + err);
  } else {
    logger.info('Connected to MongoDB!');
      
    rabbit.connect(rabbit_config, (err, conn) => {
      logger.info('Connected to RabbitMQ!');

      rabbit.setChannelPrefetch('batch.listen.1', 1);
      rabbit.consume('actions.1', 'batch.actions.q.1', (actionsMsg) => {
        // next 2 lines for debugging
        let actionsMessage = JSON.stringify(actionsMsg.content);
        logger.debug('Actions Message: ' + actionsMessage);        
        rabbit.ack('actions.1', actionsMsg);
        actionsController(actionsMsg.content);
        // QUESTION: new? or created new class for this? or something else?
      }, { noAck: false }); 
    });
  }
});

// Graceful shutdown SIG handling
const signals= {
  'SIGTERM': 15
}

Object.keys(signals).forEach((signal) => {
  process.on(signal, () => {
    logger.info(`Process received a ${signal} signal`);
    shutdown(signal, signals[signal]);
  });
});

const shutdown = (signal, value) => {
  logger.info('shutdown!');
    logger.info(`Server stopped by ${signal} with value ${value}`);
    rabbit.disconnect(() => {
      logger.info('Rabbit disconnected!');
      mongoose.disconnect();
      logger.info('Mongo disconnected!')
    });
};
