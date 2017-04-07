import Ember from 'ember';
import DS from 'ember-data';
import ApplicationSerializer from './application';

const { EmbeddedRecordsMixin } = DS;
const { Mixin } = Ember;

export default ApplicationSerializer.extend(DS.EmbeddedRecordsMixin, {
  normalize(model, hash, prop) {
    var ret = this._super(...arguments);
    return ret;
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
    markers: { embedded: 'always' }
  }

});
