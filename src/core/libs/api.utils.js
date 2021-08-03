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

function httpPostLabelPromise(url, accessToken, labelName) {
    const options = {
      url: url,
      headers: {
        'Authorization': 'Bearer ' + accessToken
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
        if (!error) {
          resolve(body);
        } else {
          let errorResponse = {
            errorUrl: 'POST - Error contacting ' + url,
            errorBody: JSON.stringify(body)
          }
          reject(errorResponse);
        }
      })
    });
  }

  function httpGetLabelsPromise(url, accessToken) {
    const options = {
      url: url,
      headers: {
        'Authorization': 'Bearer ' + accessToken
      },
    };

    return new Promise((resolve, reject) => {
      request.get(options, (error, response, body) => {
        if (!error) {
          resolve(JSON.parse(body));
        } else {
          let errorResponse = {
            errorUrl: 'GET - Error contacting ' + url + ': ' + error,
            errorBody: JSON.stringify(body)
          }
          reject(errorResponse);
        }
      })
    });
  }

  function httpPostFilterPromise(url, accessToken, labelId, senderAddress) {
    const options = {
      url: url,
      headers: {
        'Authorization': 'Bearer ' + accessToken
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
          let errorResponse = {
            errorUrl: 'POST - Error contacting ' + url,
            errorBody: JSON.stringify(body)
          }
          reject(errorResponse);
        }
      })
    });
  }
  
  function httpSendEmailPromise(url, accessToken, to, subject) {

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
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'message/rfc822'
      },
      body: raw
    }

    return new Promise((resolve, reject) => {
      request.post(options, (error, res, body) => {
        if (!error) {
          resolve(body);
        } else {
          let errorResponse = {
            errorUrl: 'POST - Error contacting ' + url + ': ' + error,
            errorBody: JSON.stringify(body)
          }
          reject(errorResponse);
        }
      })
    });

  }

  exports.httpSendMessageRequest = function(accessToken, to, subject) {
    let url = GMAIL_MESSAGE_SEND_ENDPOINT;
    let retries = GAPI_MAX_RETRIES;
    let delay = GAPI_INIT_RETRY_DELAY;
    let delayMultiplier = GAPI_DELAY_MULTIPLIER;
    let promiseCreator = () => httpSendEmailPromise(url, accessToken, to, subject);

    return retryHttpRequest(promiseCreator, retries, delay, delayMultiplier);
  }


  exports.httpCreateLabelRequest = function(accessToken, labelName) {
    let url = GMAIL_LABEL_ENDPOINT;
    let retries = GAPI_MAX_RETRIES;
    let delay = GAPI_INIT_RETRY_DELAY;
    let delayMultiplier = GAPI_DELAY_MULTIPLIER;
    let promiseCreator = () => httpPostLabelPromise(url, accessToken, labelName);
  
    return retryHttpRequest(promiseCreator, retries, delay, delayMultiplier);
  }

  exports.httpGetLabelsRequest = function(accessToken) {
    let url = GMAIL_LABEL_ENDPOINT;
    let retries = GAPI_MAX_RETRIES;
    let delay = GAPI_INIT_RETRY_DELAY;
    let delayMultiplier = GAPI_DELAY_MULTIPLIER;
    let promiseCreator = () => httpGetLabelsPromise(url, accessToken);
    
    return retryHttpRequest(promiseCreator, retries, delay, delayMultiplier);
  }

  exports.httpCreateFilterRequest = function(accessToken, labelId, senderAddress) {
    let url = GMAIL_FILTER_ENDPOINT;
    let retries = GAPI_MAX_RETRIES;
    let delay = GAPI_INIT_RETRY_DELAY;
    let delayMultiplier = GAPI_DELAY_MULTIPLIER;
    let promiseCreator = () => httpPostFilterPromise(url, accessToken, labelId, senderAddress);

    return retryHttpRequest(promiseCreator, retries, delay, delayMultiplier);
  }