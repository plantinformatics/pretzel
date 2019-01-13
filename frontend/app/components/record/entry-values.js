import Ember from 'ember';
import EntryBase from './entry-base';

import DS from 'ember-data';

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

 /** {{!-- type is blocks array */
  valueIsBlocksArray : Ember.computed('values', 'values.length', function () {
    let
    length = this.get('values.length'),
    isBlocksArray = length;
    return isBlocksArray;
  }),


  valuesIsMap : Ember.computed('values', function () {
    function isMapFn (values) { return values.constructor === Map; };
    let
      /** if values is a promise, then result is also.   */
      values = this.get('values'),
    isMap = values.then ?
      DS.PromiseObject.create({promise : values.then(isMapFn)})
    : isMapFn(values);
    return isMap;
  }),

  levelComponent : Ember.computed('levelMeta', 'values', function () {
    let levelMeta = this.get('levelMeta'),
    values = this.get('values'),
    isMap = values && values.constructor === Map,
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
