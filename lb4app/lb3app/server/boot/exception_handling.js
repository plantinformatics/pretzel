'use strict';

/* global module */
/* global process */

//------------------------------------------------------------------------------

module.exports = function(app) {

  process.on('uncaughtException', (err) => {
    console.error('Unhandled Exception:', err);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
  });

};

//------------------------------------------------------------------------------
