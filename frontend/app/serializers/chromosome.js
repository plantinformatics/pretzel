import Ember from 'ember';
import DS from 'ember-data';
import ApplicationSerializer from './application';

const { EmbeddedRecordsMixin } = DS;
const { Mixin } = Ember;

export default ApplicationSerializer.extend({

  partialSerializersExtensions: {
    extended: {
      attrs: {
        markers: { embedded: 'always' }
      }
    }
  },

  partialSerializersMixins: {
    extended: [EmbeddedRecordsMixin]
  }

});
