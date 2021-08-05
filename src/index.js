const logger = require('./loggers/log4js');
const mongoose = require('mongoose');
const rabbit = require('zero-rabbit');
const {
  rabbitConfig,
  userTopology,
} = require('./config/rabbit.config');

const actionsController = require('./core/actions.controller');

const {
  MONGO_URI,
  ACTIONS_HEALTH_HOST,
  ACTIONS_HEALTH_PORT,
} = require('./config/init.config');

// Print out the value of all env vars
const envVars = require('./config/init.config');
Object.keys(envVars).forEach((envVar) => {
  logger.info(envVar + ': ' + envVars[envVar]);
});


const express = require('express');
const KubeHealthCheck = express();
KubeHealthCheck.get('/healthz', (req, res, next) => {
  res.status(200).send();
});

mongoose.connect(
    MONGO_URI,
    {useNewUrlParser: true, useUnifiedTopology: true},
    (err, db) => {
      if (err) {
        throw new Error('Error in mongoose.connect(): ' + err);
      }

      logger.info('Connected to MongoDB!');
      rabbit.connect(rabbitConfig, (err, conn) => {
        if (err) {
          throw new Error('Error in rabbit.connect(): ' + err);
        };

        const server =
          KubeHealthCheck.listen(ACTIONS_HEALTH_PORT, ACTIONS_HEALTH_HOST);
        processHandler(server);
        logger.info(`Running health check on http://${ACTIONS_HEALTH_HOST}:${ACTIONS_HEALTH_PORT}`);

        logger.info('Connected to RabbitMQ!');
        rabbit.setChannelPrefetch(userTopology.channels.listen, 1);

        const actionsQueue = userTopology.queues.actions;
        rabbit.consume(
            userTopology.channels.listen, actionsQueue,
            (actionsMsg) => {
              const userId = actionsMsg.content.userId;
              logger.addContext('userId', userId + ' - ');
              actionsController(actionsMsg);
            }, {noAck: false});
      });
    },
);


// Graceful shutdown SIG handling
/**
 * @param  {ExpressJs} server
 */
function processHandler(server) {
  const signals = {
    'SIGHUP': 1,
    'SIGINT': 2,
    'SIGQUIT': 3,
    'SIGABRT': 6,
    // 'SIGKILL': 9, // doesn't work
    'SIGTERM': 15,
  };

  Object.keys(signals).forEach((signal) => {
    process.on(signal, () => {
      logger.info(`Process received a ${signal} signal`);
      shutdown(server, signal, signals[signal]);
    });
  });
}

const shutdown = (server, signal, value) => {
  logger.info('shutdown!');
  logger.info(`Service stopped by ${signal} with value ${value}`);
  rabbit.disconnect(() => {
    logger.info('Rabbit disconnected!');
    mongoose.disconnect((error) => {
      logger.info('Mongo disconnected!');
    });
    server.close(() => {
      logger.info('Express health server closed!');
    });
  });
};
