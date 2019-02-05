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
    },
    dataTypeName(value) {
      return this.dataTypeName(value);
    },
    levelComponent(value) {
      return this.levelComponent(value);
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
    function isMapFn (values) { return values && values.constructor === Map; };
    let
    isMap =
      this.valuesIs(isMapFn);
    return isMap;
  }),

  /**
   * @param value to lookup in levelMeta
   * @return the dataTypeName of the values.
   */
  dataTypeName (value) {
    let
      levelMeta = this.get('levelMeta'),
    dataTypeName = levelMeta.get(value)
    ;
    return dataTypeName;
  },

  /** Based on the type of values, as recorded via levelMeta,
   * @return the dataTypeName of the values.
   * Initially, for Parent and Scope, dataTypeName referred to the type of the collection,
   * but have now added both Dataset and Datasets, so to be consistent Parent and Scope should be Parents and Scopes.
   */
  values_dataTypeName : Ember.computed('levelMeta', 'values', function () {
    let
    values = this.get('values'),
    dataTypeName = this.dataTypeName(values)
    ;
    return dataTypeName;
  }),

  /** Based on the type of values, as recorded via levelMeta,
   * @param values to lookup in levelMeta.  May be e.g. a single element of this.get('values').
   * @param dataTypeName  of values, or if undefined then lookup this.get('values').
   * This handles the case of Dataset value within Parent values, or more generally,
   * allows a value within a collection (values) to have a different type than
   * the default indicated by the dataTypeName of the collection.
   * @return the name of the component which should be used to render values.
   */
  levelComponent(values, dataTypeName) {
    if (! dataTypeName && values) {
      dataTypeName = this.dataTypeName(values);
    }
    let
    isMap = values && values.constructor === Map,
    component =
      isMap ? 'record/entry-level' :
      (dataTypeName === 'Dataset') ? 'record/entry-dataset-level' :
      (dataTypeName === 'Datasets') ? 'record/entry-datasets' :
      (dataTypeName === 'Parent') ? 'record/entry-parent' :
      (dataTypeName === 'Scope') ? 'record/entry-scope' :
      /** 'Parents' is passed to entry-values by entry-tab,
       * and 'Scopes' is passed to entry-values by entry-parent.
       * Because those 2 are hard-wired in the hbs, the 2 configurations
       * here are not looked-up.
       */
      (dataTypeName === 'Parents') ? 'record/entry-values' :
      (dataTypeName === 'Scopes') ? 'record/entry-values' :
      'record/entry-level';
    console.log('levelComponent', values, isMap, dataTypeName, component);
    return component;
  },
  /** Based on the type of values, as recorded via levelMeta,
   * @return the name of the component which should be used to render values.
   */
  values_levelComponent : Ember.computed('values_dataTypeName', 'values', function () {
    let
    values = this.get('values'),
    dataTypeName = this.dataTypeName(values),
    component = this.levelComponent(values, dataTypeName);
    return component;
  })

});
