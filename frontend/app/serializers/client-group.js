import ApplicationSerializer from './application';
import { pluralize } from 'ember-inflector';

import JSONAPISerializer from '@ember-data/serializer/json-api';
/*
import JSONSerializer from '@ember-data/serializer/json';
*/


import { attribute2relationship, normalizeDataEmbedded } from '../utils/ember-serializer';

// -----------------------------------------------------------------------------

const dLog = console.debug;

/** if required, create a record for the given id in the store
 */
function ensureIdRecord(store, modelName, id) {
  let r = 
      store.peekRecord(modelName, id) ||
      store.push({data: {id, type: modelName}});
  return r;
}


// -----------------------------------------------------------------------------

export default class ClientGroupSerializer extends JSONAPISerializer {  // ApplicationSerializer {
  normalize(model, hash, prop) {
    dLog('normalize', model, hash, prop);
    var ret = this._super(...arguments);
    return ret;
  };
  /** normalize the result of /groups/in
   * @param d response data
   */
  normalizeGroupsIn(d) {
    const fnName = 'normalizeGroupsIn';
    dLog(fnName, d);
    let
    /** these could be params, making the function more generic. */
    modelName = 'client-group',
    /** client is effectively handled by attribute2relationship() following */
    modelNameIncluded = ['group', 'client'],
    includedPlural = false;
    let result = normalizeDataEmbedded(this.store, modelName, modelNameIncluded, includedPlural, d);
    let data = result.included[0];
    data.relationships = {};
    attribute2relationship(data, undefined, 'client', 'clientId');

    let 
    store = this.store,
    primaryModelClass = store.modelFor(modelName),
    clientId = d.group.clientId,
    normalizePush1 =  (store, modelNameIncluded) => {
      let
    secondaryModelClass = store.modelFor(modelNameIncluded),
    subN = this.normalizeSingleResponse(store, secondaryModelClass, {group : result.included}, d.id,   'groups/in'),
      /** equiv : g = subN.group[0], clientId = g.relationships[0].client.data.id,  */
      /** or add .links */
      // clientR = ensureIdRecord(store, 'client', clientId),
      subR = store.push({data: subN[modelNameIncluded]});
      if (! subR[0].clientId.get('id')) {
        let subR2 = store.pushPayload('group', {data: subN.group});
      }
      return subR;
    };
    // modelNameIncluded.forEach((modelNameIncluded) => normalizePush1(store, modelNameIncluded));
    // normalizePush1(store, modelNameIncluded[0]);

    let
    clientsP = store.findByIds('client', [clientId]),
    /* n = this.normalizeSingleResponse(
      store, primaryModelClass, {'client-group' : result.data}, d.id, 'groups/in'), //  requestType
    nr = store.push({data: n['client-group']}), */
    nr = clientsP.then((clients) => {
      dLog(fnName, clients[0].email, JSON.stringify(result));
      let cgR = store.push(result);
      dLog(fnName, cgR.get('groupId.clientId.email'));
      return cgR; }),
    result2 = nr;
    dLog(fnName, result2);

    return result2;
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
