import Ember from 'ember';
import EntryBase from './entry-base';

import DS from 'ember-data';

import { logV  } from '../../utils/value-tree';

import { parentOfType, elt0 } from '../../utils/ember-devel';

/*----------------------------------------------------------------------------*/


/** For use when debugging via web inspector console. */
var levelMeta;

const trace_entryValues = 1;

/*----------------------------------------------------------------------------*/


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
  tagName: '',

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
    },
    levelComponentEach(value) {
      return this.levelComponentEach(value);
    }
  },

  /** type is array, e.g. blocks or datasets */
  valueIsArray : Ember.computed('values', 'values.[]', function () {
    let
      values = this.get('values'),
    length = this.get('values.length'),
    isArray = Ember.isArray(values);
    if (trace_entryValues)
      console.log('valueIsArray', isArray, length, this.get('name'), values);
    return isArray;
  }),

  /** type of values is an array of Dataset-s */
  valueIsDatasetsArray : Ember.computed('valueIsArray', 'values_dataTypeName', function () {
    let
      isMap = this.get('valueIsArray'),
    dataTypeName = this.get('values_dataTypeName'),
    isDatasetsArray = ! isMap && (dataTypeName === 'Datasets');
    return isDatasetsArray;
  }),

  /** {{!-- type is blocks array */
  valueIsBlocksArray : Ember.computed('valueIsArray', 'values_dataTypeName', function () {
    let
      isMap = this.get('valueIsArray'),
    dataTypeName = this.get('values_dataTypeName'),
    isBlocksArray = ! isMap && (dataTypeName === 'Blocks');
    return isBlocksArray;
  }),

  /** lookup the levelMeta for values.
   * (if none and values is an array, use modelName of an array element).
   */
  values_dataTypeName : Ember.computed('values',  function () {
    let
      levelMeta = this.get('levelMeta'),
    values = this.get('values'),  // values.then ...
    dataTypeName = values && (levelMeta.get(values) || this.get('valuesModelName'));
    if (trace_entryValues)
      console.log('dataTypeName', dataTypeName, values);
    return dataTypeName;
  }),
  valuesModelName : Ember.computed('values',  function () {
    let values = this.get('values'),
    modelName = this.modelName2(values);
    return modelName;
  }),
  /** Lookup modelName of values
   * or if values is a non-empty array, use modelName of an array element.
   */
  modelName2(values) {
    let modelName;
    if (values) {
      if (values.length && values[0])
      {
        modelName = this.modelName(values[0]);
        if (modelName)
          modelName = modelName + 's';
      }
      else
        modelName = this.modelName(values);
      if (modelName)
        modelName = modelName.capitalize();
    }
    return modelName;
  },
  modelName(value) {
    // e.g. "dataset".  equivalent to _internalModel.modelName
    let modelName = value.constructor.modelName;
    return modelName;
  },

  /** Evaluate isFn against this.get('values'), which may be a promise, so the
   * result may be a promise. */
  valuesIs(isFn) {
    let
      /** if values is a promise, then result is also.   */
      values = this.get('values'),
    is =
      /** values should not be undefined - debugging */
      ((values === undefined) || (values === null)) ?
      (trace_entryValues && console.log('valuesIs', this), false)
      : values.then ?
      DS.PromiseObject.create({promise : values.then(isFn)})
    : isFn(values);
    return is;
  },

  /** @return true if values is an Object. */
  valuesIsObject : Ember.computed('values', function () {
    function isObjectFn (values) { return typeof values === 'object'; };
    let
      isObject =
      this.valuesIs(isObjectFn);
    return isObject;
  }),

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
  values_dataTypeName0 : Ember.computed('levelMeta', 'values', function () {
    let
      values = this.get('values'),
    dataTypeName = this.dataTypeName(values)
    ;
    return dataTypeName;
  }),

  /** Based on the type of values, as recorded via levelMeta,
   *
   * The components named by the return value have a common API :
   *  name
   *  values  also passed as 'data' for entry-dataset-level
   *  levelMeta
   *  select / load for Dataset and Block : loadBlock, selectBlock, selectedBlock, selectDataset.
   *
   * In addition, this param is passed to prevent entry-values from recursing without progressing down from parent to child values :
   *  parentDone=true
   *
   * @param values to lookup in levelMeta.  May be e.g. a single element of this.get('values').
   *  if undefined then lookup this.get('values').
   * @return the name of the component which should be used to render values.
   */
  levelComponent(values) {
    if (values === undefined)
      values = this.get('values');

    let dataTypeName = this.dataTypeName(values);
    if (! dataTypeName && values) {
      dataTypeName = this.modelName2(values);
    }
    let
      isMap = values && values.constructor === Map,
    component =
      isMap ? 'record/entry-level' :
      (dataTypeName === 'Dataset') ? 'record/entry-dataset-level' :
      (dataTypeName === 'Datasets') ? 'record/entry-datasets' :
      (dataTypeName === 'Parent') ? 'record/entry-parent' :
      (dataTypeName === 'Scope') ? 'record/entry-scope' :
      (dataTypeName === 'Blocks') ? 'record/entry-blocks-array' :
      /** 'Parents' is passed to entry-values by entry-tab,
       * and 'Scopes' is passed to entry-values by entry-parent.
       * Because those 2 are hard-wired in the hbs, the 2 configurations
       * here are not read / looked-up.
       */
      (dataTypeName === 'Parents') ? 'record/entry-values' :
      (dataTypeName === 'Scopes') ? 'record/entry-values' :
      (dataTypeName === 'Groups') ? 'record/entry-values' :
      (dataTypeName === 'Group') ? 'record/entry-values' :
      undefined;
    if (trace_entryValues)
      console.log('levelComponent', values, isMap, dataTypeName, component);
    return component;
  },
  /** Based on the type of values, as recorded via levelMeta and modelName,
   * @return the name of the component which should be used to render values.
   */
  values_levelComponent : Ember.computed('values_dataTypeName', 'values', function () {
    let
      values = this.get('values'),
    component = this.levelComponent(values);
    return component;
  }),
  /** Some of the templates returned by levelComponent() render the key as well as the value; the others will rely on entry-level to render the key.
   * @return the name of the component which should be used to render key and values.
   */
  levelComponentEach : function (values) {
    let
    component = this.levelComponent(values);
    if ((component !== 'record/entry-dataset-level') &&
        (component !== 'record/entry-scope'))
      component = 'record/entry-level';

    return component;
  },

  /*--------------------------------------------------------------------------*/
  /** Devel functions, useful in web inspector console, e.g. use Ember tab to
   * select the Ember entry-values Component, export $E to the console and
   * $E.log3(), etc.
   */
  log1() {
    /** current component */
    let c = this;
    console.log(
      c._debugContainerKey, c.get('name'), c.get('values'),
      c.get('values_dataTypeName'), c.get('values_levelComponent'),
      c.get('valueIsArray'),
      elt0(c.elementId || c.parentView.elementId)
    );
  },
  /** log parent entry-values of this */
  logP() {
    let parent = parentOfType.apply(this, ["component:record/entry-values"]);
    if (parent)
      parent.log1();
  },
  /** log childView-s of this */
  logC() {
    let children = this.childViews;
    for (let i=0; i < children.length; i++) {
      let child = children[i];
      if (child.log1)
        child.log1();
      else {
        let c = child;
        console.log(
          c._debugContainerKey, c.get('name'), c.get('values'),
          this.dataTypeName(c.get('values')),
          elt0(c.elementId || c.parentView.elementId));
      }
    }
  },
  log3() {
    this.logP();
    this.log1();
    this.logC();
  },
  /** logV() shows the value tree, with types associated via levelMeta.  */
  logV(v) {
    if (v === undefined)
      v = this.get('values');

    /** global for debugging. */
    if (! levelMeta)
      levelMeta = this.get('levelMeta');
    logV(levelMeta, v);
  }
  /*--------------------------------------------------------------------------*/


});
