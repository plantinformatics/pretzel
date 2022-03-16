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

/**
 * @param modelName included object
 */
function attribute2relationship(data, included, modelName, fieldName) {
  let
  attributes = data.attributes;
  let id = attributes[fieldName];
  delete attributes[fieldName];

  let
  host = 'http://localhost:3000', // store.adapterOptions.host || '',
  links = {
    self: host + '/api/' + pluralize(modelName) + '/' + id
  },
  includedDataValue = {id, type : modelName/*pluralize()*/ /*, links*/ },
  includedData = {
    data: includedDataValue
  };
  /* data.relationships [] also seemed to work.  {} is the json-api convention.
  entry = [fieldName, includedData],  // modelName
  relationships = Object.fromEntries([entry]);
  data.relationships.push(relationships);
  */
  data.relationships[fieldName] = includedData;
}

/** normalize the result of /groups/in
 * @param modelNameIncluded array of modelName; related object is embedded / included
 * @param modifyFn  move data .attributes to .relationships, and possibly .included
 * @param modelNameRelation related object; field is object id.
 * @param d response data
 */
function normalizeDataEmbedded(store, modelName, modelNameIncluded, includedPlural, d) {
  const fnName = 'normalizeDataEmbedded';
  dLog(fnName, d);
  let
  host = store.adapterOptions.host || '',
  data = normalizeData(modelName, host, d),
  included = [],
  include1 = function (modelNameIncluded, includedPlural, d, attributes) {
    let
    modelNameIncP = includedPlural ? pluralize(modelNameIncluded) : modelNameIncluded,
    modelNameIncId = includedPlural ? modelNameIncP : modelNameIncP + 'Id',

    d_included = d[modelNameIncP],
    includedDataValue;
    if (d_included) {
      let
      /** if included model is not an array then put it in [] */
      d_includedP = includedPlural ? d_included : [d_included],
      included1 = d_includedP.map((c) => normalizeData(modelNameIncluded, host, c)),
      subR = store.push({data: included1}),

      data2IncFn = (c) => ({ type : modelNameIncluded, id: c.id || breakPoint(fnName, 'data2IncFn', c) });
      includedDataValue = includedPlural ? d_included.map(data2IncFn) : data2IncFn(d_included);
      included = included.concat(included1);
    } else {
      let id = d[modelNameIncP + 'Id'];
      includedDataValue = {id, type : modelNameIncP };
    }
    let
    includedData = {
      data: includedDataValue
    },
    entry = [modelNameIncId, includedData];

    delete attributes[modelNameIncId];
    return entry;
  },
  includedEntries = modelNameIncluded.map((modelNameIncludedi) => include1(modelNameIncludedi, includedPlural, d, data.attributes)),
  relationships = Object.fromEntries(includedEntries);
  data.relationships = relationships;
  let
  result = {
    data, included
  };

  dLog(fnName, result);
  return result;
};


export {
  normalizeData,
  attribute2relationship,
  normalizeDataEmbedded,
};
