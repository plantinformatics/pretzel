/* global exports */

exports.noCacheResult = noCacheResult;
/** Indicate that a remote method result is dynamic and should not be cached.
 * Usage e.g.
 *   Dataset.afterRemote('vcfGenotypeFeaturesCountsStatus', noCacheResult);
 */
function noCacheResult(context, remoteMethodOutput, next) {
  const response = context.res;
  response.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Expires', '0');
  next();
}
