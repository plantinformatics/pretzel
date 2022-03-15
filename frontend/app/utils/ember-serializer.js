import { pluralize } from 'ember-inflector';


import { breakPoint } from './breakPoint';

// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------

  /** part of normalize -> JSON API
   */
  function normalizeData(modelName, host, d) {
    dLog('normalizeData', modelName, host, d);
    let
    /** trim out /in .group, and /own .clients. caller does .relationships */
    {id, group, clients, ...attributes} = d,
    links = {
      self: host + '/api/' + pluralize(modelName) + '/' + id
    },
    data = {
      type : modelName,
      id,
      attributes,
      links,
    };
    return data;
  };

  /** normalize the result of /groups/in
   * @param d response data
   */
  function normalizeDataEmbedded(store, modelName, modelNameIncluded, includedPlural, d) {
    const fnName = 'normalizeDataEmbedded';
    dLog(fnName, d);
    let
    host = store.adapterOptions.host || '',
    data = normalizeData(modelName, host, d),
    modelNameIncP = includedPlural ? pluralize(modelNameIncluded) : modelNameIncluded,

    d_included = d[modelNameIncP],
    /** if included model is not an array then put it in [] */
    d_includedP = includedPlural ? d_included : [d_included],
    data2IncFn = (c) => ({ type : modelNameIncluded, id: c.id || breakPoint(fnName, 'data2IncFn', c) }),
    includedDataValue = includedPlural ? d_included.map(data2IncFn) : data2IncFn(d_included),
    includedData = {
        data: includedDataValue
    },
    modelNameIncId = includedPlural ? modelNameIncP : modelNameIncP + 'Id',
    relationships = Object.fromEntries([[modelNameIncId, includedData]]);
    data.relationships = relationships;
    delete data.attributes[modelNameIncId];
    let
    included = d_includedP.map((c) => normalizeData(modelNameIncluded, host, c)),
    subR = store.push({data: included}),
    result = {
      data, included
    };

    dLog(fnName, result);
    return result;
  };


export {
  normalizeData,
  normalizeDataEmbedded,
};
