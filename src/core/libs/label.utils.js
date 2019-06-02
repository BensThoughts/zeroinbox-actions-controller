const {
    GAPI_DELAY_MULTIPLIER,
    GAPI_MAX_RETRIES,
    GAPI_INIT_RETRY_DELAY,
    GMAIL_LABEL_ENDPOINT
  } = require('../../config/init.config');

const logger = require('../../loggers/log4js');
const request = require('request');

function retryHttpRequest(promiseCreator, retries, delay, delayMultiplier) {
    return new Promise((resolve, reject) => {
      promiseCreator()
        .then(resolve)
        .catch((err) => {
          if (retries == 0) {
            reject(err);
          } else {
            let retryFunc = function() {
              retries--;
              delay = delay * delayMultiplier;
              resolve(retryHttpRequest(promiseCreator, retries, delay, delayMultiplier));
            }
            setTimeout(retryFunc, delay);
          }
        });
      });
}

function httpPostLabelPromise(url, access_token, labelName) {
    const options = {
      url: url,
      headers: {
        'Authorization': 'Bearer ' + access_token
      },
      body: {
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
        name: labelName
      },
      json: true
    };

    return new Promise((resolve, reject) => {
      request.post(options, (error, response, body) => {
        if (!error && response.statusCode == 200) {
          resolve(body);
        } else {
          logger.error('Error contacting ' + url + ': ' + JSON.stringify(error));
          reject(error);
        }
      })
    });
  }

  function httpGetLabelsPromise(url, access_token) {
    const options = {
      url: url,
      headers: {
        'Authorization': 'Bearer ' + access_token
      },
    };

    return new Promise((resolve, reject) => {
      request.get(options, (error, response, body) => {
        if (!error && response.statusCode == 200) {
          resolve(JSON.parse(body));
        } else {
          logger.error('Error contacting ' + url + ': ' + JSON.stringify(error));
          reject(error);
        }
      })
    });
  }

  exports.httpPostLabelRequest = function(access_token, labelName) {
    let url = GMAIL_LABEL_ENDPOINT;
    let retries = GAPI_MAX_RETRIES;
    let delay = GAPI_INIT_RETRY_DELAY;
    let delayMultiplier = GAPI_DELAY_MULTIPLIER;
    let promiseCreator = () => httpPostLabelPromise(url, access_token, labelName);
  
    return retryHttpRequest(promiseCreator, retries, delay, delayMultiplier);
  }

  exports.httpGetLabelsRequest = function(access_token) {
    let url = GMAIL_LABEL_ENDPOINT;
    let retries = GAPI_MAX_RETRIES;
    let delay = GAPI_INIT_RETRY_DELAY;
    let delayMultiplier = GAPI_DELAY_MULTIPLIER;
    let promiseCreator = () => httpGetLabelsPromise(url, access_token);
    
    return retryHttpRequest(promiseCreator, retries, delay, delayMultiplier);
  }