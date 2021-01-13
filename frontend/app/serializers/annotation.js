import Mixin from '@ember/object/mixin';
import { EmbeddedRecordsMixin } from '@ember-data/serializer/rest';
import ApplicationSerializer from './application';

export default ApplicationSerializer.extend(EmbeddedRecordsMixin, {
  // normalize(model, hash, prop) {
  //   console.log('NORMALIZE', model, hash, prop)
  //   delete hash.count
  //   console.log(hash)
  //   var ret = this._super(...arguments);
  //   console.log('AFTER RED', ret)
  //   // delete ret.count
  //   return ret;
  // },
  serialize(snapshot, options) {
    console.log('SERIALIZE', snapshot, options)
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


});
