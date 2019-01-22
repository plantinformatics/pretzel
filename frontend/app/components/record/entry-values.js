import Ember from 'ember';
import EntryBase from './entry-base';

import DS from 'ember-data';

/** Render values using the appropriate {{each}} and / or template component
 * according to the type of values.
 *
 * @param values  data to render
 * @param levelMeta WeakMap which records the type of values
 * @param loadBlock
 * @param selectBlock
 * @param selectedBlock
 * @param selectDataset
 */
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

 /** type is array, e.g. blocks or datasets */
  valueIsArray : Ember.computed('values', 'values.length', function () {
    let
    length = this.get('values.length'),
    isArray = length;
    console.log('valueIsArray', isArray, this.get('name'), this.get('values'));
    return isArray;
  }),

  /** type of values is an array of Dataset-s */
  valueIsDatasetsArray : Ember.computed('valuesIsMap', function () {
    let
      isMap = this.get('valuesIsMap'),
    dataTypeName = this.valueLevelMeta(),
    isDatasetsArray = ! isMap && (dataTypeName === 'Datasets');
    return isDatasetsArray;
  }),

 /** {{!-- type is blocks array */
  valueIsBlocksArray : Ember.computed('valuesIsMap', function () {
    let
      isMap = this.get('valuesIsMap'),
    dataTypeName = this.valueLevelMeta(),
    isBlocksArray = ! isMap && (dataTypeName === 'Blocks');
    return isBlocksArray;
  }),

  /** lookup the levelMeta for values.
   * (if none and values is an array, use modelName of an array element).
   */
  valueLevelMeta() {
    let
      levelMeta = this.get('levelMeta'),
    values = this.get('values'),  // values.then ...
    dataTypeName = values && levelMeta.get(values);
    if (! dataTypeName && values && values.length)
    {
      // e.g. "dataset".  equivalent to _internalModel.modelName
      dataTypeName = values[0].constructor.modelName.capitalize() + 's';
    }
    console.log('dataTypeName', dataTypeName, values);
    return dataTypeName;
  },

  /** Evaluate isFn against this.get('values'), which may be a promise, so the
   * result may be a promise. */
  valuesIs(isFn) {
    let
      /** if values is a promise, then result is also.   */
      values = this.get('values'),
    is =
      /** values should not be undefined - debugging */
      !values ?
      (console.log('valuesIs', this), false)
      : values.then ?
      DS.PromiseObject.create({promise : values.then(isFn)})
    : isFn(values);
    return is;
  },

  /** @return true if values is a Map. */
  valuesIsMap : Ember.computed('values', function () {
    function isMapFn (values) { return values.constructor === Map; };
    let
    isMap =
      this.valuesIs(isMapFn);
    return isMap;
  }),

  /** Based on the type of values, as recorded via levelMeta,
   * @return the name of the component which should be used to render values.
   */
  levelComponent : Ember.computed('levelMeta', 'values', function () {
    let levelMeta = this.get('levelMeta'),
    values = this.get('values'),
    isMap = values && values.constructor === Map,
    dataTypeName = levelMeta.get(values),
    component =
      isMap ? 'record/entry-level' :
      (dataTypeName === 'Datasets') ? 'record/entry-datasets' :
      (dataTypeName === 'Parent') ? 'record/entry-parent' :
      (dataTypeName === 'Scope') ? 'record/entry-scope' :
      'record/entry-level';
    console.log('levelComponent', isMap, dataTypeName, component);
    return component;
  })

});
