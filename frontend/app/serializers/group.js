import ApplicationSerializer from './application';
import { pluralize } from 'ember-inflector';


import { normalizeDataEmbedded } from '../utils/ember-serializer';

// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------

export default class GroupSerializer extends ApplicationSerializer {
  normalize(model, hash, prop) {
    dLog('normalize', model, hash, prop);
    var ret = this._super(...arguments);
    return ret;
  };
  /** normalize the result of /groups/in
   * @param d response data
   */
  normalizeGroupsOwn(d) {
    dLog('normalizeGroupsOwn', d);
    let
    /** these could be params, making the function more generic. */
    modelName = 'group',
    modelNameIncluded = 'client',
    includedPlural = true;
    let result = normalizeDataEmbedded(this.store, modelName, modelNameIncluded, includedPlural, d);
    return result;
  };

}
