import ApplicationSerializer from './application';
import { pluralize } from 'ember-inflector';

import { attribute2relationship, normalizeDataEmbedded } from '../utils/ember-serializer';

// -----------------------------------------------------------------------------

const dLog = console.debug;


// -----------------------------------------------------------------------------

export default class ClientGroupSerializer extends ApplicationSerializer {
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
    /** client is handled by attribute2relationship() following */
    modelNameIncluded = ['group'],
    includedPlural = false;
    let result = normalizeDataEmbedded(this.store, modelName, modelNameIncluded, includedPlural, d);
    let data = result.included[0];
    /** result.data.relationships is set by normalizeDataEmbedded(), but not data.relationships */
    data.relationships = {};
    attribute2relationship(data, undefined, 'client', 'clientId');

    dLog(fnName, JSON.stringify(result));

    return result;
  };

}
