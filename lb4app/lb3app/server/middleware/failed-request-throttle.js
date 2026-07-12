'use strict';

var rateLimitModule = require('express-rate-limit');
var slowDownModule = require('express-slow-down');
var SlowDownMemoryStore = require('express-slow-down/lib/memory-store');

var rateLimit = rateLimitModule.rateLimit || rateLimitModule.default || rateLimitModule;
var slowDown = slowDownModule.slowDown || slowDownModule.default || slowDownModule;

function numberOption(value, fallback) {
  var parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Used by slowDown() and rateLimit() for skipSuccessfulRequests,
 * i.e. if this function returns true no slow-down or rate limit is applied.
 * Return true for statusCode < 400, with this exception :
 * Return false for 301 because invalid URLs currently result in 301.
 */
function responseSucceeded(req, res) {
  return (res.statusCode != 301) && (res.statusCode < 400);
}

function defaultKeyGenerator(req) {
  return req.ip;
}

module.exports = function failedRequestThrottle(options) {
  options = options || {};

  var windowMs = numberOption(options.windowMs, 15 * 60 * 1000);
  var slowDownStore = options.slowDown && options.slowDown.store;
  var slowDownKeyGenerator =
    options.slowDown && options.slowDown.keyGenerator || defaultKeyGenerator;
  var slowDownSkip = options.slowDown && options.slowDown.skip || function() {
    return false;
  };

  slowDownStore = slowDownStore || new SlowDownMemoryStore(windowMs);
  if (typeof slowDownStore.decrement !== 'function') {
    throw new Error('failed-request-throttle slowDown.store must implement decrement().');
  }

  var slowDownOptions = Object.assign({
    windowMs: windowMs,
    delayAfter: 5,
    delayMs: 1000,
    maxDelayMs: 10000,
    store: slowDownStore,
    keyGenerator: slowDownKeyGenerator,
    skip: slowDownSkip,
  }, options.slowDown);
  slowDownOptions.skipSuccessfulRequests = false;

  var rateLimitOptions = Object.assign({
    windowMs: windowMs,
    max: 60,
    skipSuccessfulRequests: true,
    requestWasSuccessful: responseSucceeded,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many failed requests, please try again later.',
  }, options.rateLimit);

  var slowDownMiddleware = slowDown(slowDownOptions);
  var rateLimitMiddleware = rateLimit(rateLimitOptions);

  return function failedRequestThrottleMiddleware(req, res, next) {
    var key;
    if (! slowDownOptions.skip(req, res)) {
      key = slowDownOptions.keyGenerator(req, res);
      res.on('finish', function() {
        if (responseSucceeded(req, res)) {
          slowDownStore.decrement(key);
        }
      });
    }

    slowDownMiddleware(req, res, function(err) {
      if (err) {
        return next(err);
      }

      rateLimitMiddleware(req, res, next);
    });
  };
};
