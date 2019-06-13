const mongoose = require('mongoose');
const logger = require('./loggers/log4js');

const rabbit = require('zero-rabbit');

const actionsController = require('./core/actions.controller');

const { 
  mongo_uri,
  actions_health_host,
  actions_health_port
} = require('./config/init.config');
const { rabbit_config } = require('./config/rabbit.config');

const express = require('express');
const KubeHealthCheck = express();
KubeHealthCheck.get('/healthz', (req, res, next) => {
  res.status(200).send();
});


mongoose.connect(mongo_uri, { useNewUrlParser: true }, (err, db) => {
  if (err) {
    logger.error('Error at mongoose.connect(): ' + err);
  } else {
    logger.info('Connected to MongoDB!');
      
    rabbit.connect(rabbit_config, (err, conn) => {
      logger.info('Connected to RabbitMQ!');

      rabbit.setChannelPrefetch('actions.1', 1);

      rabbit.consume('actions.1', 'actions.userIds.q.1', (userIdMsg) => {
        let userIdMessage = userIdsMsg.content;
        let userId = userIdMessage.userId;
        logger.trace('New userId actions message, userId: ' + userId);
        consumer(userIdMsg);
      }, { noAck: true });

      let server = googleApi.listen(actions_health_port, actions_health_host);
      processHandler(server);
      logger.info(`Running health check on http://${actions_health_host}:${actions_health_port}`);
    });
  }
});

function consumer(userIdMsg) {
  let userId = userIdMsg.content.userId;
  rabbit.assertQueue('actions.userId.' + userId, 'actions.userId.' + userId, { autoDelete: false, durable: true }, (assertQueueErr, q) => {
    if (assertQueueErr) {
      return logger.error(assertQueueErr);
    } else {
      rabbit.setChannelPrefetch('actions.userId.' + userId, 1);
      rabbit.bindQueue('actions.userId.' + userId, 'actions.userId.' + userId, 'actions.topic.ex.1', 'userId.' + userId, {}, (bindExchangeErr, ok) => {
        if (bindExchangeErr) {
          return logger.error(bindExchangeErr);
        } else {
          rabbit.consume('actions.userId.' + userId, 'actions.userId.' + userId, (actionsMsg) => {
            let actionsMessage = JSON.stringify(actionsMsg.content);
            logger.trace('Actions Message: ' + actionsMessage);
            actionsController(actionsMsg, userIdMsg);
          }, { noAck: false })
        }
      });
    }
  });
}

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
