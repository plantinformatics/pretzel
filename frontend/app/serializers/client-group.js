import ApplicationSerializer from './application';
import { pluralize } from 'ember-inflector';

/*
import JSONAPISerializer from '@ember-data/serializer/json-api';
import JSONSerializer from '@ember-data/serializer/json';
*/


import { normalizeDataEmbedded } from '../utils/ember-serializer';

// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------

export default class ClientGroupSerializer extends /*JSONSerializer { API */ ApplicationSerializer {
  normalize(model, hash, prop) {
    dLog('normalize', model, hash, prop);
    var ret = this._super(...arguments);
    return ret;
  };
  /** normalize the result of /groups/in
   * @param d response data
   */
  normalizeGroupsIn(d) {
    dLog('normalizeGroupsIn', d);
    let
    /** these could be params, making the function more generic. */
    modelName = 'client-group',
    modelNameIncluded = 'group',
    includedPlural = false;
    let result = normalizeDataEmbedded(this.store, modelName, modelNameIncluded, includedPlural, d);
    return result;
  };

  /** same, tried using JSONAPISerializer  */
  normalizeGroupsIn2(payload) {
    const fnName = 'normalizeGroupsIn2';
    dLog(fnName, payload);
    let
    store = this.store,
    primaryModelClass = store.modelFor('group'); // data.modelName);
    let result = this.normalizeSingleResponse(
      store, primaryModelClass, {data : payload}, payload.group.id, /*requestType*/ 'groups/in');

    dLog(fnName, result);
    return result;
  };
}
