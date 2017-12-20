import Ember from 'ember';
import DS from 'ember-data';
import ApplicationSerializer from './application';

export default ApplicationSerializer.extend(DS.EmbeddedRecordsMixin, {
  normalize(model, hash, prop) {
    var ret = this._super(...arguments);
    return ret;
  },
  serialize(snapshot, options) {
    let json = this._super(...arguments);
    // delete json.chromosomes
    json.chromosomes = []
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
    chromosomes: { embedded: 'always' }
  }
});
