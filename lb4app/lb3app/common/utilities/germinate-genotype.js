const util = require('util');

const { Germinate } = require('./germinate');
const { ErrorStatus } = require('./errorStatus.js');

/* global exports */
/* global require */

//------------------------------------------------------------------------------
/** The scope of this module is :
 * . use of Germinate server connection to implement Pretzel genotype requests.
 *
 * Related ./germinate.js
 */
//------------------------------------------------------------------------------

let germinateInstance;
/** Used by API requests to ensure Germinate session is connected and
 * authenticated, so they can use it to fulfill requests.
 * @return a promise which resolves with germinateInstance or
 * rejects with ErrorStatus(), which the caller can pass to response cb.
 */
function useGerminate() {
  const fnName = 'useGerminate';
  let connectedP;
  if (! germinateInstance) {
      germinateInstance = new Germinate();
  }
  connectedP = germinateInstance.connectedP()
    .then(() => germinateInstance)
    .catch(error => {
      console.log(fnName, 'Germinate', error);
      throw ErrorStatus(503, error) ; // statusCode
    });

/*
  if (! germinate) {
    try {
      console.log(fnName, germinate);
      // germinate.serverinfo(); // germplasm(); // callsets();
    } catch (error) {
      // throw
    }
  }
*/
  return connectedP;
}

/** refn : https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
502 Bad Gateway
    This error response means that the server, while working as a gateway to get a response needed to handle the request, got an invalid response.
503 Service Unavailable
 */

//------------------------------------------------------------------------------

/** [datasetId + scope] -> [callSetName] -> callSetDbId */
const callSetName2DbId = {};
/** @return sample name cache for datasetId:scope
 */
function callSetCacheForBlock(datasetId, scope) {
  const
  blockName = datasetId + '_' + scope,
  name2DbId = callSetName2DbId[blockName] || (callSetName2DbId[blockName] = {});
  return name2DbId;
}
/** if sample name cache for datasetId:scope is not empty, yield it, otherwise
 * get samples then yield it.
 * @return promise
 */
function callSetCacheForBlockP(datasetId, scope) {
  const
  name2DbId = callSetCacheForBlock(datasetId, scope),
  /** if name2DbId is not empty, yield it, otherwise get samples then yield it. */
  p = name2DbId && Object.keys(name2DbId).length ? Promise.resolve(name2DbId) : 
    util.promisify(germinateGenotypeSamples)(datasetId, scope)
    .then(samples => callSetCacheForBlock(datasetId, scope));
  return p;
}

exports.germinateGenotypeSamples = germinateGenotypeSamples;
function germinateGenotypeSamples(datasetId, scope, cb) {
  useGerminate()
    .then((germinate) => {
    const samplesP = germinate.samples('4' /*datasetId, scope*/);
    samplesP
      .then(response => {
        const samples = response.result.data.map(d => d.callSetName);
        const name2Id = callSetCacheForBlock(datasetId, scope);
        response.result.data.forEach(d => (name2Id[d.callSetName] = d.callSetDbId));
        cb(null, samples);
      })
      .catch(error => cb(error));
    })
    .catch(cb);
}

exports.germinateGenotypeLookup = germinateGenotypeLookup;
function germinateGenotypeLookup(datasetId, scope, preArgs, nLines, undefined, cb) {
  const
  fnName = 'germinateGenotypeLookup',
  /** get samples for datasetId : scope if not cached. */
  name2IdP = callSetCacheForBlockP(datasetId, scope);
  Promise.all([name2IdP, useGerminate()])
    .then(([name2Id, germinate]) => {
    // preArgs.samples '1-593'
    // preArgs.region : scope + ':' + domainInteger.join('-'),
    const
    samples = preArgs.samples,
    match = preArgs.region.match(/.+:([0-9]+)-([0-9]+)/);
    let all, start, end;
    if (match) {
      [all, start, end] = match;
    }
    const
    sampleNames = preArgs.samples.split('\n'),
    samplesDataP = sampleNames.map(sampleName => {
      // e.g. '1-593'
      const
      callSetDbId = name2Id[sampleName],
      dataP = ! callSetDbId ? 
        Promise.resolve([]) :
        germinate.callsetsCalls(callSetDbId, start, end)
        .then(response => response.result.data);
      return dataP;
    });
    Promise.all(samplesDataP)
      .then(samplesData => {
        cb(null, samplesData.flat());
      })
      .catch(error => cb(error));
    })
    .catch(cb);
}

//------------------------------------------------------------------------------
