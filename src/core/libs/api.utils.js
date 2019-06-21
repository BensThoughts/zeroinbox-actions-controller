const {
    GAPI_DELAY_MULTIPLIER,
    GAPI_MAX_RETRIES,
    GAPI_INIT_RETRY_DELAY,
    GMAIL_LABEL_ENDPOINT,
    GMAIL_MESSAGE_SEND_ENDPOINT,
    GMAIL_FILTER_ENDPOINT
  } = require('../../config/init.config');

const logger = require('../../loggers/log4js');
const request = require('request');

function retryHttpRequest(promiseCreator, retries, delay, delayMultiplier) {
    return new Promise((resolve, reject) => {
      promiseCreator()
        .then(resolve)
        .catch((err) => {
          if (retries == 0) {
            logger.error('Error inside retryHttpRequest: ' + err);
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
        logger.debug('POST to: ' + url);
        logger.debug('Error: ' + error);
        logger.debug('body: ' + body);
        // logger.debug('response : ' + response);
        if (!error) {
          // logger.trace(JSON.stringify(body));
          resolve(body);
        } else {
          logger.error('Error contacting ' + url + ': ' + error);
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
        logger.debug('GET to: ' + url);
        logger.debug('Error: ' + error);
        logger.debug('body: ' + body);
        // logger.debug('response : ' + response);
        if (!error) {
          resolve(JSON.parse(body));
        } else {
          logger.error('Error contacting ' + url + ': ' + JSON.stringify(error));
          reject(error);
        }
      })
    });
  }

  function httpPostFilterPromise(url, access_token, labelId, senderAddress) {
    const options = {
      url: url,
      headers: {
        'Authorization': 'Bearer ' + access_token
      },
      body: {
        criteria: {
          from: senderAddress
        },
        action: {
          addLabelIds: [labelId],
          removeLabelIds: ['INBOX']
        }
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
  
  function httpSendEmailPromise(url, access_token, to, subject) {

    function makeBody(to, subject, message) {
      let str = ["to: ", to, "\n",
              // "from: ", from, "\n",
              "subject: ", subject, "\n\n",
              // message,
            ].join('');
      return str;
    }

    let raw = makeBody(to, subject);

    let options = {
      url: url,
      // method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + access_token,
        'Content-Type': 'message/rfc822'
      },
      body: raw
    }

    return new Promise((resolve, reject) => {
      request.post(options, (error, res, body) => {
        if (!error) {
          resolve(body);
        } else {
          logger.error('Error contacting ' + url + ': ' + JSON.stringify(error));
          reject(error);
        }
      })
    });

  }

  exports.httpSendMessageRequest = function(access_token, to, subject) {
    let url = GMAIL_MESSAGE_SEND_ENDPOINT;
    let retries = GAPI_MAX_RETRIES;
    let delay = GAPI_INIT_RETRY_DELAY;
    let delayMultiplier = GAPI_DELAY_MULTIPLIER;
    let promiseCreator = () => httpSendEmailPromise(url, access_token, to, subject);

    return retryHttpRequest(promiseCreator, retries, delay, delayMultiplier);
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

  exports.httpPostFilterRequest = function(access_token, labelId, senderAddress) {
    let url = GMAIL_FILTER_ENDPOINT;
    let retries = GAPI_MAX_RETRIES;
    let delay = GAPI_INIT_RETRY_DELAY;
    let delayMultiplier = GAPI_DELAY_MULTIPLIER;
    let promiseCreator = () => httpPostFilterPromise(url, access_token, labelId, senderAddress);

    return retryHttpRequest(promiseCreator, retries, delay, delayMultiplier);
  }