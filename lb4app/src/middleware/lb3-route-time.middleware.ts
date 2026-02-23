// LB3 middleware wrapper from lb3app/server/middleware/route_time.js
// Provides request timing logs.
const routeTime = require('../../lb3app/server/middleware/route_time');

export function lb3RouteTimeMiddleware() {
  return routeTime();
}
