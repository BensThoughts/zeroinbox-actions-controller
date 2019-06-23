const logger = require('./loggers/log4js');
const mongoose = require('mongoose');
const rabbit = require('zero-rabbit');
const { 
  rabbit_config,
  rabbit_topology
} = require('./config/rabbit.config');

const actionsController = require('./core/actions.controller');

const { 
  MONGO_URI,
  ACTIONS_HEALTH_HOST,
  ACTIONS_HEALTH_PORT
} = require('./config/init.config');

const express = require('express');
const KubeHealthCheck = express();
KubeHealthCheck.get('/healthz', (req, res, next) => {
  res.status(200).send();
});

mongoose.connect(MONGO_URI, { useNewUrlParser: true }, (err, db) => {
  if (err) {
    logger.error('Error at mongoose.connect(): ' + err);
  } else {
    logger.info('Connected to MongoDB!');
      
    rabbit.connect(rabbit_config, (err, conn) => {
      logger.info('Connected to RabbitMQ!');

      rabbit.setChannelPrefetch(rabbit_topology.channels.listen, 1);

      let actionsQueue = rabbit_topology.queues.actions;
      rabbit.consume(rabbit_topology.channels.listen, actionsQueue, (actionsMsg) => {
        let actionsObj = actionsMsg.content;
        let userId = actionsObj.userId;
        logger.trace(userId + ' - New actions message: ' + JSON.stringify(actionsObj));
          actionsController(actionsMsg);
      }, { noAck: false });

      let server = KubeHealthCheck.listen(ACTIONS_HEALTH_PORT, ACTIONS_HEALTH_HOST);
      processHandler(server);
      logger.info(`Running health check on http://${ACTIONS_HEALTH_HOST}:${ACTIONS_HEALTH_PORT}`);
    });
  }
});


// Graceful shutdown SIG handling
const signals= {
  'SIGTERM': 15
}

function processHandler(server) {
  Object.keys(signals).forEach((signal) => {
    process.on(signal, () => {
      logger.info(`Process received a ${signal} signal`);
      shutdown(server, signal, signals[signal]);
    });
  });
}

const shutdown = (server, signal, value) => {
  logger.info('shutdown!');
    logger.info(`Server stopped by ${signal} with value ${value}`);
    rabbit.disconnect(() => {
      logger.info('Rabbit disconnected!');
      mongoose.disconnect((error) => {

      });
      server.close(() => {

      })
      logger.info('Mongo disconnected!')
    });
};