import { EmbeddedRecordsMixin } from '@ember-data/serializer/rest';
import ApplicationSerializer from './application';

export default ApplicationSerializer.extend(EmbeddedRecordsMixin, {
  primaryKey: 'name',
  normalize(model, hash, prop) {
    var ret = this._super(...arguments);
    return ret;
  },
  serialize(snapshot, options) {
    let json = this._super(...arguments);
    // delete json.blocks
    json.blocks = []
    delete json.createdAt
    delete json.updatedAt
    return json;
  },
  serializeIntoHash: function(hash, type, record, options) {
    let serial = this.serialize(record, options);
    //edit hash in place because the calling function (adapters/application.js)
    // does not use the return by default
    Object.keys(serial).forEach(function(key) {
      hash[key] = serial[key]
    });
    return hash;
  },

  attrs: {
    blocks: { embedded: 'always' },
    parentName : 'parent',
    /** The Pretzel data format defines Dataset and Block to have a .meta field;
     * since Ember3 this clashes with the ember-data object .meta field, so it is
     * renamed to ._meta.  This rename could be done also in the Pretzel data
     * format (pretzel-data). */
    _meta : 'meta',
    /** Refer to .name as ._name, so that .name can be an alias to .displayName */
    _name : 'name',
  }
});
