'use strict';

// handling required for four auth scenarios
// it is intended that the following checks and assignments
// handle control logic issues throughout the app in advance
// of testing them as they occur
// 1 No auth at all
// 2 Auth with no email verification
// 3 Auth with email verification by user
// 4 Auth with email verification by admin

function errorAndExit(message) {
  console.error(message);
  process.exit(1);
}

//
// - - - - - LOCAL EMAIL CONFIG - - - - - -
//
// For email verification to be enabled, key settings
// are required: EMAIL_HOST, EMAIL_PORT, EMAIL_FROM
let configEmail = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_FROM']
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

// assigning verification email state
// if env var is missing, adopt admin verification
// to assume most secure verification option by default
let verifyOptions = ['NONE', 'USER', 'ADMIN']
if (!process.env.EMAIL_VERIFY) {
  process.env.EMAIL_VERIFY = 'ADMIN'
  console.log(`EMAIL_VERIFY missing, options are ${verifyOptions}, set as ${process.env.EMAIL_VERIFY} by default`);
}

// checking EMAIL_VERIFY setting against handled options
if (verifyOptions.indexOf(process.env.EMAIL_VERIFY) < 0) {
  errorAndExit(`EMAIL_VERIFY mode ${process.env.EMAIL_VERIFY} is not valid`);
}

// test scenarios for various email config
if (process.env.EMAIL_ACTIVE == 'true') {

  if (process.env.EMAIL_VERIFY == 'ADMIN') {
    // scenario - email configured, ADMIN verification recipient but not specified / empty
    if (!process.env.EMAIL_ADMIN || process.env.EMAIL_ADMIN.length == 0) {
      errorAndExit('EMAIL_ADMIN is required when EMAIL_VERIFY=ADMIN');
    }
  }
} else if (process.env.EMAIL_ACTIVE == 'false') {

  // scenario - no email configuration, but required USER / ADMIN verification
  if (process.env.EMAIL_VERIFY != 'NONE') {
    errorAndExit(`Missing EMAIL SMTP settings when EMAIL_VERIFY=${process.env.EMAIL_VERIFY}`);
  }
} else {
  // unexpected error with EMAIL_ACTIVE env var assignment
  // this is not anticipated to ever be logged
  errorAndExit(`Unexpected error with EMAIL_ACTIVE decision, assigned as ${process.env.EMAIL_ACTIVE}. Please contact the developer.`);
}