import Mixin from '@ember/object/mixin';
import { EmbeddedRecordsMixin } from '@ember-data/serializer/rest';
import ApplicationSerializer from './application';

export default ApplicationSerializer.extend(EmbeddedRecordsMixin, {
  normalize(model, hash, prop) {
    var ret = this._super(...arguments);
    return ret;
  },
  serialize(snapshot, options) {
    let json = this._super(...arguments);
    delete json.features
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

  /*partialSerializersExtensions: {
    extended: {
      attrs: {
        markers: { embedded: 'always' }
      }
    }
  },

  partialSerializersMixins: {
    extended: [EmbeddedRecordsMixin]
  }*/

  attrs: {
    annotations: { embedded: 'always' },
    intervals: { embedded: 'always' },
    features: { embedded: 'always' },
    // _scope : 'scope',
    /** Rename Pretzel Block .meta to ._meta to avoid clash with ember-data object
     * .meta, as commented in ./dataset.js : attrs : _meta
     */
    _meta : 'meta'
  }

});
