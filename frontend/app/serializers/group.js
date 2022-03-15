import ApplicationSerializer from './application';
import { pluralize } from 'ember-inflector';
import JSONAPISerializer from '@ember-data/serializer/json-api';


import { normalizeDataEmbedded } from '../utils/ember-serializer';

// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------

export default class GroupSerializer extends JSONAPISerializer { // ApplicationSerializer {
  normalize(model, hash, prop) {
    dLog('normalize', model, hash, prop);
    var ret = this._super(...arguments);
    return ret;
  };
  /** normalize the result of /groups/in
   * @param d response data
   */
  normalizeGroupsOwn(d) {
    const fnName = 'normalizeGroupsOwn';
    dLog(fnName, d);
    let
    /** these could be params, making the function more generic. */
    modelName = 'group',
    modelNameIncluded = 'client',
    includedPlural = true;
    let result = normalizeDataEmbedded(this.store, modelName, modelNameIncluded, includedPlural, d);

    let 
    store = this.store,
    primaryModelClass = store.modelFor(modelName),
    secondaryModelClass = store.modelFor(modelNameIncluded),
    subN = this.normalizeSingleResponse(store, primaryModelClass, {client : result.included}, d.id,   'groups/own'),
    subR = store.push({data: subN[modelNameIncluded]}),
    n = this.normalizeSingleResponse(
      store, primaryModelClass, {group : result.data}, d.id, /*requestType*/ 'groups/own'),
    nr = store.push({data: n.group}),
    result2 = nr;

    dLog(fnName, result2);

    return result2;
  };

}
