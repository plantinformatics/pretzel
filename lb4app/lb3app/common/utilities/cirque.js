/* global exports */

// -----------------------------------------------------------------------------

/** Usage e.g.
 *    if (! ok) {
 *      cirquePush('isOwner ' + data.clientId + ', ' + userId);
 *    }
 *    ...
 *      if (! ok) {
 *        cirquePush('access ' + modelName + ', ' + userId);
 *        cirqueTail(10);
 *      }
 *
 * as used in :  server/boot/access.js
 */

// -----------------------------------------------------------------------------

/** circular queue of log message strings relating to permission === false. */
const cirqueLength = 50;
let cirque = [], cirqueNext = 0;
function cirquePush(text) {
  cirque[cirqueNext] = text;
  if (cirqueNext++ >= cirqueLength) {
    console.log('cirquePush', cirqueNext, text);
    cirqueNext = 0;
  }
}
exports.cirquePush = cirquePush;
/** show last n.
 * Clear buffer.
 */
function cirqueTail(n) {
  let
  from = ((cirqueNext - n) + cirqueLength) % cirqueLength,
  split = cirqueNext - n < 0,
  end = split ? cirque.slice(from, cirqueLength) : [],
  start = cirque.slice(split ? 0 : from, cirqueNext);
  console.log('cirqueTail', n, cirqueNext, end, start);
  cirqueClear();
}
exports.cirqueTail = cirqueTail;

/** Clear entire buffer.
 */
function cirqueClear() {
  cirque = []; cirqueNext = 0;
}
exports.cirqueClear = cirqueClear;


function cirqueTestSetup() {
  for (let i=0; i < cirqueLength; i++) { cirquePush(''+i); }
  console.log(cirque, cirque[0], cirque[cirqueLength-1], cirqueNext);
}

// -----------------------------------------------------------------------------

function testCase1() {
  cirqueTestSetup();
  /** result shown on console */
  let result;
  result = [
  /*Array(50)*/ [ "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", /*...*/ ],
  "0 49 50"];

  cirqueTail(51);
  result = [
  "cirqueTail 51 50 ",
  /*Array*/ [ "49" ],
  /*Array(50)*/ [ "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", /*...*/ ]];

  cirqueNext = 10;
  // 10

  cirqueTail(5);
  result = [
    "cirqueTail 5 10 ",
    /*Array*/ [], 
    /*Array(5)*/ [ "5", "6", "7", "8", "9" ]];

  cirqueTail(15);
  result = [
    "cirqueTail 15 10 ",
    /*Array(5)*/ [ "45", "46", "47", "48", "49" ],
    /*Array(10)*/ [ "0", "1", "2", "3", "4", "5", "6", "7", "8", "9" ]];
}

// -----------------------------------------------------------------------------
