// const util = require('util');
// promisify = util.promisify;
import bluebird from 'bluebird';
const promisify = bluebird/*Promise*/.promisify;

import { Germinate } from './germinate';
// const { ErrorStatus } = require('./errorStatus.js');

//------------------------------------------------------------------------------
/** The scope of this module is :
 * . use of Germinate server connection to implement Pretzel genotype requests.
 *
 * Related ./germinate.js
 */
//------------------------------------------------------------------------------

let germinateInstance;
export { useGerminate };
/** Used by API requests to ensure Germinate session is connected and
 * authenticated, so they can use it to fulfill requests.
 * @param username, password  optional. Used in frontend not in backend.
 * @return a promise which resolves with germinateInstance or
 * rejects with ErrorStatus(), which the caller can pass to response cb.
 */
function useGerminate(username, password) {
  const fnName = 'useGerminate';
  let connectedP;
  if (! germinateInstance) {
      germinateInstance = new Germinate();
  }
  // if pre-existing germinateInstance and it has these fields, they are overridden.
  if (username && password) {
    germinateInstance.setCredentials(username, password);
  }
  connectedP = germinateInstance.connectedP()
    .then(() => germinateInstance)
    .catch(error => {
      console.log(fnName, 'Germinate', error);
      // ErrorStatus() is used in server, not useful in frontend/.
      throw Error(error); // ErrorStatus(503, error) ; // statusCode
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

const germinateGenotypeSamplesP = promisify(germinateGenotypeSamples);

/** if sample name cache for datasetId:scope is not empty, yield it, otherwise
 * get samples then yield it.
 * @return promise
 */
function callSetCacheForBlockP(datasetId, scope) {
  const
  name2DbId = callSetCacheForBlock(datasetId, scope),
  /** if name2DbId is not empty, yield it, otherwise get samples then yield it. */
  p = name2DbId && Object.keys(name2DbId).length ? Promise.resolve(name2DbId) : 
    germinateGenotypeSamplesP(datasetId, scope)
    .then(samples => callSetCacheForBlock(datasetId, scope));
  return p;
}

export { germinateGenotypeSamples };
function germinateGenotypeSamples(datasetId, scope, cb) {
  useGerminate()
    .then((germinate) => {
    const samplesP = germinate.samples(datasetId);
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

export { germinateGenotypeLookup };
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
      linkageGroupName = preArgs.linkageGroupName,
      dataP = ! callSetDbId ? 
        Promise.resolve([]) :
        germinate.callsetsCalls(callSetDbId, linkageGroupName, start, end)
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
/** copied from lb4app/lb3app/common/models/block.js : Block.vcfGenotypeLookup() :  ensureSamplesParam() */

export { ensureSamplesParam };

/** Ensure that preArgs.samples is defined : if undefined, request samples
 * and use the first one.  */
function ensureSamplesParam(datasetId, scope, preArgs) {
  let argsP;
  if (! preArgs?.samples?.length) {
    argsP = germinateGenotypeSamplesP(datasetId, scope)
      .then(samples => {
        let sample;
        if (samples.length) {
          sample = samples[0];
        } else {
          sample = '';
        }
        // could use Object.assign() to avoid mutating preArgs.
        preArgs.samples = sample;
        return preArgs;
      });
  } else {
    argsP = Promise.resolve(preArgs);
  }
  return argsP;
}

//------------------------------------------------------------------------------
