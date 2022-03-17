import ApplicationSerializer from './application';
import { pluralize } from 'ember-inflector';

import JSONSerializer from '@ember-data/serializer/json';

import { attribute2relationship, normalizeDataEmbedded } from '../utils/ember-serializer';

// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------

export default class GroupsOwnSerializer extends ApplicationSerializer {
  normalize(model, hash, prop) {
    dLog('normalize', model, hash, prop);
    let ret;
    if (this._super === JSONSerializer.proto().normalizeResponse) {
      /** as in serializers/application.js : normalizeResponse() */
      let payload = {};
      payload[model.modelName] = hash;
      // model === this.serializerFor(prop)
      ret = this._super(this.store, model, payload, hash.id, /*requestType*/'findRecord');
    } else {
      ret = this._super(...arguments);
    }
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
    let result = normalizeDataEmbedded(this.store, modelName, [modelNameIncluded], includedPlural, d);

    let data = result.data;
    // data.relationships is initialised
    attribute2relationship(data, undefined, 'client', 'clientId');

    dLog(fnName, result);

    return result;
  };

}
