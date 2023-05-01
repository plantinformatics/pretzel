const { Germinate } = require('./germinate');

/* global exports */
/* global require */

//------------------------------------------------------------------------------

let germinate;
function useGerminate() {
  if (! germinate) {
    try {
      germinate = new Germinate();
      console.log('germinate', germinate);
      // germinate.serverinfo(); // germplasm(); // callsets();
    } catch (error) {
      console.log(fnName, 'Germinate', error);
    }
  }
  return germinate;
}

//------------------------------------------------------------------------------

/** [datasetId + scope] -> [callSetName] -> callSetDbId */
const callSetName2DbId = {};
function callSetCacheForBlock(datasetId, scope) {
  const
  blockName = datasetId + '_' + scope,
  name2DbId = callSetName2DbId[blockName] || (callSetName2DbId[blockName] = {});
  return name2DbId;
}
exports.germinateGenotypeSamples = germinateGenotypeSamples;
function germinateGenotypeSamples(datasetId, scope, cb) {
  if ((germinate = useGerminate())) {
    const samplesP = germinate.samples('1' /*datasetId, scope*/);
    samplesP
      .then(response => {
        const samples = response.result.data.map(d => d.callSetName);
        const name2Id = callSetCacheForBlock(datasetId, scope);
        response.result.data.forEach(d => (name2Id[d.callSetName] = d.callSetDbId));
        cb(null, samples);
      })
      .catch(error => cb(error));
  }
}

exports.germinateGenotypeLookup = germinateGenotypeLookup;
function germinateGenotypeLookup(datasetId, scope, preArgs, nLines, undefined, cb) {
  const fnName = 'germinateGenotypeLookup';
  if ((germinate = useGerminate())) {
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
    name2Id = callSetCacheForBlock(datasetId, scope),
    sampleNames = preArgs.samples.split('\n'),
    samplesDataP = sampleNames.map(sampleName => {
      // e.g. '1-593'
      const
      callSetDbId = name2Id[sampleName],
      dataP = (callSetDbId ? germinate.callsetsCalls(callSetDbId, start, end) : Promise([]))
        .then(response => response.result.data);
      return dataP;
    });
    Promise.all(samplesDataP)
      .then(samplesData => {
        cb(null, samplesData.flat());
      })
      .catch(error => cb(error));
  }
}

//------------------------------------------------------------------------------
