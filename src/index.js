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
  // ACTIONS_HEALTH_HOST,
  ACTIONS_HEALTH_PORT,
} = require('./config/init.config');

// Print out the value of all env vars
const envVars = require('./config/init.config');
Object.keys(envVars).forEach((envVar) => {
  logger.info(envVar + ': ' + envVars[envVar]);
});


const express = require('express');
const kubeHealthCheck = express();
kubeHealthCheck.get('/healthcheck', (req, res, next) => {
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
        kubeHealthCheck
            .listen(ACTIONS_HEALTH_PORT, () => {
              logger.info('Express server started for health checks');
            });
        const address = server.address();
        logger.info(address);
        processHandler(server);

        logger.info('Connected to RabbitMQ!');
        rabbit.setChannelPrefetch(userTopology.channels.listen, 1);

        const actionsQueue = userTopology.queues.actions;
        rabbit.consume(
            userTopology.channels.listen, actionsQueue,
            (actionsMsg) => {
              const userId = actionsMsg.content.userId;
              logger.addContext('userId', userId + ' - ');
              logger.info(`incoming message ${JSON.stringify(actionsMsg.content)}`)
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
  logger.info(`Actions service stopped by ${signal} with value ${value}`);
  rabbit.disconnect((rabbitErr) => {
    if (rabbitErr) {
      logger.error('RabbitMQ disconnect error: ' + rabbitErr);
      process.exitCode = 1;
    }
    logger.info('Rabbit disconnected!');
    mongoose.disconnect((mongooseError) => {
      if (mongooseError) {
        logger.error('Mongo disconnect error: ' + mongooseError);
        process.exitCode = 1;
      }
      logger.info('MongoDB disconnected!');
      server.close((serverErr) => {
        if (serverErr) {
          logger.error('ExpressJS Health Check Server Error: ' + serverErr);
          process.exitCode = 1;
        }
        logger.info('ExpressJS Health Check Server Closed!');
        process.exitCode = 0;
      });
    });
  });
};
