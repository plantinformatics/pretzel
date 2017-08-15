'use strict';

//
// - - - - - LOCAL EMAIL CONFIG - - - - - -
//
// due to loading sequence, EMAIL_ACTIVE is to be set
// here, as model-config.local.js is loaded before
// datasources.local.
// TODO check if necessary once routes integrated
if (process.env.EMAIL_HOST && 
    process.env.EMAIL_PORT && 
    process.env.EMAIL_FROM) {
  // enable email if host and port provided
  console.log('Starting process with email service')
  process.env.EMAIL_ACTIVE = 'true'
} else {
  // no mail validation or password reset facilities
  console.log('No email service specified for process')
  process.env.EMAIL_ACTIVE = 'false'
}

if (process.env.EMAIL_VERIFY != 'NONE' && process.env.EMAIL_ACTIVE == 'false') {
  console.log('Configuration error: Missing SMTP settings');
  process.exit(1);
}
if (process.env.EMAIL_VERIFY == 'ADMIN') {
  if (!process.env.ADMIN_EMAIL || process.env.ADMIN_EMAIL.length == 0) {
    console.log('Configuration error: ADMIN_EMAIL is required for admin email verification');
    process.exit(1);
  }
}


// Build the providers/passport config
// var config = {};
// try {
// 	config = require('../providers.json');
// } catch (err) {
//   console.trace(err);
//   console.error('Please configure your passport strategy in `providers.json`.');
//   console.error('Copy `providers.example.json` to `providers.json` and replace the clientID/clientSecret values with your own.');
// 	process.exit(1); // fatal
// }