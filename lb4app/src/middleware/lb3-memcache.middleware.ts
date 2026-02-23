// LB3 middleware wrapper from lb3app/server/middleware/memcache.js
// Provides in-memory caching for selected routes.
const memcache = require('../../lb3app/server/middleware/memcache');

export function lb3MemcacheMiddleware(durationSeconds: number) {
  return memcache({duration: durationSeconds});
}
