import {RestApplication} from '@loopback/rest';

// Lightweight wrappers to reuse LB3 boot scripts where behavior still applies.

export function initLb3Environment(): void {
  // Source: lb3app/server/environment.js
  // This module executes on require and validates env vars.
  require('../../lb3app/server/environment');
}

export function initLb3ExceptionHandling(app: RestApplication): void {
  // Source: lb3app/server/boot/exception_handling.js
  const fn = require('../../lb3app/server/boot/exception_handling');
  fn(app);
}

export function initLb3FrontendEnvironment(app: RestApplication): void {
  // Source: lb3app/server/boot/frontend-environment.js
  const fn = require('../../lb3app/server/boot/frontend-environment');
  fn(app);
}
