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

/** Move a data.attributes value to data.relationships
 * @param modelName of object referenced by value
 * @param fieldName which contains the value to move
 */
function attribute2relationship(data, included, modelName, fieldName) {
  let
  attributes = data.attributes;
  let id = attributes[fieldName];
  delete attributes[fieldName];

  let
  /** earlier version applied pluralize() to modelName, and constructed .links,
   * commented-out in 9888b660, seems not required.
   */
  includedDataValue = {id, type : modelName},
  includedData = {
    data: includedDataValue
  };
  data.relationships[fieldName] = includedData;
}

/** normalize the result of /groups/in and /groups/own
 * @param store used for host in links, and to push included
 * @param modelName
 * @param modelNameIncluded array of modelName; related object is embedded / included
 * @param includedPlural if true then pluralize modelNameIncluded[i], otherwise append 'Id'

 * Perhaps integrate attribute2relationship(), via params such as :
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
    /** possibly get modelName and fieldName from model; or pass variant fieldName as param. */
    modelNameIncP = includedPlural ? pluralize(modelNameIncluded) : modelNameIncluded,
    modelNameIncId = includedPlural ? modelNameIncP : modelNameIncP + 'Id',

    d_included = d[modelNameIncP],
    includedDataValue;
    if (d_included) {
      let
      /** if included model is not an array then put it in [] */
      d_includedP = includedPlural ? d_included : [d_included],
      included1 = d_includedP.map((c) => normalizeData(modelNameIncluded, host, c)),
      /** this push may not be required, since included1 is appended to result.included */
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
