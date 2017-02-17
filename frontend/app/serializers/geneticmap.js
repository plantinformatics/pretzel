import Ember from 'ember';
import DS from 'ember-data';
import ApplicationSerializer from './application';

const { EmbeddedRecordsMixin } = DS;
const { Mixin } = Ember;

export default ApplicationSerializer.extend({
  normalize(model, hash, prop) {
    var ret = this._super(...arguments);
    return ret;
  },

  partialSerializersExtensions: {
    extended: {
      attrs: {
        chromosomes: { embedded: 'always' }
      }
    }
  },

  partialSerializersMixins: {
    extended: [EmbeddedRecordsMixin]
  }
});
