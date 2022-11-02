import { DEBUG } from '@glimmer/env';

if (! DEBUG) {
  console.log = function noConsoleLog() { };
}

const dLog = DEBUG ? console.debug : function noDebugLog() { };

export { dLog };
