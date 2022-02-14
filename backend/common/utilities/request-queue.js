'use strict';

/* global exports */
/* global require */

const Queue = require('promise-queue');

/*----------------------------------------------------------------------------*/

/** Example Usage */
function example_Usage (cb) {
  const queue = new Queue(/*concurrency:*/ 1);
  exports.queueAppend(requestFn, queue, 'requestName', cb);
  function requestFn(cb) {   }
}

/*----------------------------------------------------------------------------*/

function qLog(label, queue, status) {
  console.log(label, status, 'queue', queue.getPendingLength(), queue.getQueueLength());
}

exports.queueAppend = 
function queueAppend(fn, queue, requestName, cb) {
  const fnName = 'queueAppend';

  queue.add(searchP);

  function searchP() {
    let promise = new Promise(
      function (resolve, reject) {
        let cbWrap = function () { qLog(fnName, queue, 'complete:' + requestName); resolve(); cb.apply(this, arguments); };
        qLog(fnName, queue, 'starting:' + requestName);

        fn(cbWrap);
      }
    );
    return promise;
  }
};
