import Ember from 'ember';
import EntryBase from './entry-base';


export default EntryBase.extend({

  actions: {
    selectDataset(dataset) {
      console.log('selectDataset', dataset);
      this.sendAction('selectDataset', dataset);
    },
    selectBlock(block) {
      console.log('selectBlock', block);
      this.sendAction('selectBlock', block);
    }
  },


  levelComponent : Ember.computed('levelMeta', 'values', function () {
    let levelMeta = this.get('levelMeta'),
    values = this.get('values'),
    isMap = values.constructor === Map,
    dataTypeName = levelMeta.get(values),
    component =
      isMap ? 'record/entry-level' :
      (dataTypeName === 'Parent') ? 'record/entry-parent' :
      (dataTypeName === 'Scope') ? 'record/entry-scope' :
      'record/entry-level';
    console.log('levelComponent', isMap, dataTypeName, component);
    return component;
  })

});
