import ApplicationSerializer from './application';

import { EmbeddedRecordsMixin } from '@ember-data/serializer/rest';

// -----------------------------------------------------------------------------

export default class GroupSerializer extends ApplicationSerializer.extend(EmbeddedRecordsMixin) {

  /** clientGroups is included in the result of the query() in 
   * utils/data/group.js : getGroups2() : include : 'clientGroups'
   */
  attrs = {
    clientGroups: { 
      serialize: false,
      deserialize: 'records'
    }
  }

}
