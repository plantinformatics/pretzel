import Ember from 'ember';
import DS from 'ember-data';
import ApplicationSerializer from './application';

export default ApplicationSerializer.extend(DS.EmbeddedRecordsMixin, {
  normalize(model, hash, prop) {
    var ret = this._super(...arguments);
    return ret;
  },

  attrs: {
    chromosomes: { embedded: 'always' }
  }
});
