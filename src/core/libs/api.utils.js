const {
  GAPI_DELAY_MULTIPLIER,
  GAPI_MAX_RETRIES,
  GAPI_INIT_RETRY_DELAY,
  GMAIL_LABEL_ENDPOINT,
  GMAIL_MESSAGE_SEND_ENDPOINT,
  GMAIL_FILTER_ENDPOINT,
} = require('../../config/init.config');

// const logger = require('../../loggers/log4js');
const request = require('request');

/**
 * @param  {Function} promiseCreator
 * @param  {number} retries
 * @param  {number} delay
 * @param  {number} delayMultiplier
 * @return {Promise}
 */
function retryHttpRequest(promiseCreator, retries, delay, delayMultiplier) {
  return new Promise((resolve, reject) => {
    promiseCreator()
        .then(resolve)
        .catch((err) => {
          if (retries == 0) {
            reject(err);
          } else {
            const retryFunc = function() {
              retries--;
              delay = delay * delayMultiplier;
              resolve(
                  retryHttpRequest(
                      promiseCreator,
                      retries,
                      delay,
                      delayMultiplier,
                  ),
              );
            };
            setTimeout(retryFunc, delay);
          }
        });
  });
}

/**
 * @param  {string} url
 * @param  {string} accessToken
 * @param  {string} labelName
 * @return {Promise}
 */
function httpPostLabelPromise(url, accessToken, labelName) {
  const options = {
    url: url,
    headers: {
      'Authorization': 'Bearer ' + accessToken,
    },
    body: {
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
      name: labelName,
    },
    json: true,
  };

  return new Promise((resolve, reject) => {
    request.post(options, (error, response, body) => {
      if (!error) {
        resolve(body);
      } else {
        const errorResponse = {
          errorUrl: 'POST - Error contacting ' + url,
          errorBody: JSON.stringify(body),
        };
        reject(errorResponse);
      }
    });
  });
}

/**
 * @param  {string} url
 * @param  {string} accessToken
 * @return {Promise}
 */
function httpGetLabelsPromise(url, accessToken) {
  const options = {
    url: url,
    headers: {
      'Authorization': 'Bearer ' + accessToken,
    },
  };

  return new Promise((resolve, reject) => {
    request.get(options, (error, response, body) => {
      if (!error) {
        resolve(JSON.parse(body));
      } else {
        const errorResponse = {
          errorUrl: 'GET - Error contacting ' + url + ': ' + error,
          errorBody: JSON.stringify(body),
        };
        reject(errorResponse);
      }
    });
  });
}

/**
 * @param  {string} url
 * @param  {string} accessToken
 * @param  {string} labelId
 * @param  {string} senderAddress
 * @return {Promise}
 */
function httpPostFilterPromise(url, accessToken, labelId, senderAddress) {
  const options = {
    url: url,
    headers: {
      'Authorization': 'Bearer ' + accessToken,
    },
    body: {
      criteria: {
        from: senderAddress,
      },
      action: {
        addLabelIds: [labelId],
        removeLabelIds: ['INBOX'],
      },
    },
    json: true,
  };

  return new Promise((resolve, reject) => {
    request.post(options, (error, response, body) => {
      if (!error && response.statusCode == 200) {
        resolve(body);
      } else {
        const errorResponse = {
          errorUrl: 'POST - Error contacting ' + url,
          errorBody: JSON.stringify(body),
        };
        reject(errorResponse);
      }
    });
  });
}

/**
 * @param  {string} url
 * @param  {string} accessToken
 * @param  {string} to
 * @param  {string} subject
 * @return {Promise}
 */
function httpSendEmailPromise(url, accessToken, to, subject) {
  const makeBody = (to, subject, message) => {
    const str = ['to: ', to, '\n',
      // "from: ", from, "\n",
      'subject: ', subject, '\n\n',
      // message,
    ].join('');
    return str;
  };

  const raw = makeBody(to, subject);

  const options = {
    url: url,
    // method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'message/rfc822',
    },
    body: raw,
  };

  return new Promise((resolve, reject) => {
    request.post(options, (error, res, body) => {
      if (!error) {
        resolve(body);
      } else {
        const errorResponse = {
          errorUrl: 'POST - Error contacting ' + url + ': ' + error,
          errorBody: JSON.stringify(body),
        };
        reject(errorResponse);
      }
    });
  });
}

exports.httpSendMessageRequest = function(accessToken, to, subject) {
  const url = GMAIL_MESSAGE_SEND_ENDPOINT;
  const retries = GAPI_MAX_RETRIES;
  const delay = GAPI_INIT_RETRY_DELAY;
  const delayMultiplier = GAPI_DELAY_MULTIPLIER;
  const promiseCreator = () => {
    return httpSendEmailPromise(url, accessToken, to, subject);
  };

  return retryHttpRequest(promiseCreator, retries, delay, delayMultiplier);
};


exports.httpCreateLabelRequest = function(accessToken, labelName) {
  const url = GMAIL_LABEL_ENDPOINT;
  const retries = GAPI_MAX_RETRIES;
  const delay = GAPI_INIT_RETRY_DELAY;
  const delayMultiplier = GAPI_DELAY_MULTIPLIER;
  const promiseCreator = () => {
    return httpPostLabelPromise(url, accessToken, labelName);
  };

  return retryHttpRequest(promiseCreator, retries, delay, delayMultiplier);
};

exports.httpGetLabelsRequest = function(accessToken) {
  const url = GMAIL_LABEL_ENDPOINT;
  const retries = GAPI_MAX_RETRIES;
  const delay = GAPI_INIT_RETRY_DELAY;
  const delayMultiplier = GAPI_DELAY_MULTIPLIER;
  const promiseCreator = () => httpGetLabelsPromise(url, accessToken);

  return retryHttpRequest(promiseCreator, retries, delay, delayMultiplier);
};

exports.httpCreateFilterRequest =
function(accessToken, labelId, senderAddress) {
  const url = GMAIL_FILTER_ENDPOINT;
  const retries = GAPI_MAX_RETRIES;
  const delay = GAPI_INIT_RETRY_DELAY;
  const delayMultiplier = GAPI_DELAY_MULTIPLIER;
  const promiseCreator = () => {
    return httpPostFilterPromise(url, accessToken, labelId, senderAddress);
  };

  return retryHttpRequest(promiseCreator, retries, delay, delayMultiplier);
};
