import { isArray } from '@ember/array';
import { computed } from '@ember/object';
import { inject as service } from '@ember/service';

import EntryBase from './entry-base';

import DS from 'ember-data';


import { alphanum } from '@cablanchard/koelle-sort';


import { valueGetType, logV } from '../../utils/value-tree';

import { parentOfType, elt0 } from '../../utils/ember-devel';
import { toTitleCase } from '../../utils/string';

/*----------------------------------------------------------------------------*/

const dLog = console.debug;

/** For use when debugging via web inspector console. */
var levelMeta;

const trace_entryValues = 1;

const capitalize = toTitleCase;

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
  viewHistory : service('data/view'),

  tagName: '',

  actions: {
    selectDataset(dataset) {
      console.log('selectDataset', dataset);
      this.selectDataset(dataset);
    },
    selectBlock(block) {
      console.log('selectBlock', block);
      this.selectBlock(block);
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
  valueIsArray : computed('values', 'values.[]', function valueIsArray () {
    let
      values = this.get('values'),
    length = this.get('values.length'),
    /** RFC #176 (Javascript Modules API) changes Ember.isArray to isArray,
     * so append _ to variable name to distinguish it. */
    isArray_ = isArray(values);
    if (trace_entryValues > 1)
      console.log('valueIsArray', isArray_, length, this.get('name'), values);
    return isArray_;
  }),

  /** type of values is an array of Dataset-s */
  valueIsDatasetsArray : computed('valueIsArray', 'values_dataTypeName', function () {
    let
      isMap = this.get('valueIsArray'),
    dataTypeName = this.get('values_dataTypeName'),
    isDatasetsArray = ! isMap && (dataTypeName === 'Datasets');
    return isDatasetsArray;
  }),

  /** {{!-- type is blocks array */
  valueIsBlocksArray : computed('valueIsArray', 'values_dataTypeName', function () {
    let
      isMap = this.get('valueIsArray'),
    dataTypeName = this.get('values_dataTypeName'),
    isBlocksArray = ! isMap && (dataTypeName === 'Blocks');
    return isBlocksArray;
  }),

  /** lookup the levelMeta for values.
   * (if none and values is an array, use modelName of an array element).
   */
  values_dataTypeName : computed('values',  function () {
    let
      levelMeta = this.get('levelMeta'),
    values = this.get('values'),  // values.then ...
    dataTypeName = values && (valueGetType(levelMeta, values) || this.get('valuesModelName'));
    if (trace_entryValues > 1)
      console.log('dataTypeName', dataTypeName, values);
    return dataTypeName;
  }),

  values_dataName : computed('values',  function () {
    let
    levelMeta = this.get('levelMeta'),
    values = this.get('values'),
    meta = levelMeta.get(values),
    name = meta?.name;
    return name;
  }),

  valuesModelName : computed('values',  function () {
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
        modelName = capitalize(modelName);
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
  valuesIsObject : computed('values', function () {
    function isObjectFn (values) { return typeof values === 'object'; };
    let
      isObject =
      this.valuesIs(isObjectFn);
    return isObject;
  }),

  /** @return true if values is a Map. */
  valuesIsMap : computed('values', function () {
    function isMapFn (values) { return values && values.constructor === Map; };
    let
      isMap =
      this.valuesIs(isMapFn);
    return isMap;
  }),

  /*--------------------------------------------------------------------------*/

  valuesIsOntologyTree : computed('values', function () {
    // let levelMeta = this.levelMeta;
    function isOntologyTreeFn (values) {
      /* possibly : ["term", "trait"].includes(valueGetType(levelMeta, values)) */
      return values && 
      values.hasOwnProperty('id') && (typeof values.id === 'string') &&
      values.hasOwnProperty('type') && (typeof values.type === 'string') && 
      values.hasOwnProperty('children') && ((typeof values.children === 'boolean') || isArray(values.children));
    };
    let is = this.valuesIs(isOntologyTreeFn);
    return is;
  }),
  /** @return true if value is an Ontology 'trait' (leaf node). */
  isOntologyLeaf(levelMeta, value) {
    let valueType = valueGetType(levelMeta, value);
    return valueType === 'trait';
  },

  /*--------------------------------------------------------------------------*/

  /** The template uses this to display the values sorted in key order.
   * (Using {{#each-in values as |key value|}} doesn't sort by key.)
   * This could also support valuesIsMap.
   *
   * Added : filter by view history if enabled by controlOptions.{historyView,historyBlocks}.
   */
  keyValuesSorted : computed('valuesIsObject', 'controlOptions.{historyView,historyBlocks}', function () {
    let array;
    let values = this.get('values');
    if (values.then && ! (values = values._result || values.content)) {
      dLog('keyValuesSorted', this.get('values'));
    } else
    if (this.get('valuesIsObject')) {
      let o = this.controlOptions,
          recent = o.historyView === 'Recent',
          levelMeta = this.levelMeta;

      if ((valueGetType(levelMeta, values) === 'Parent')
          && o.historyBlocks
          && (o.historyView !== 'Normal')) {
        let scopes = Object.keys(values);
            values = scopes.reduce((vs, s) => {
              let blocks = values[s],
                  // this.levelMeta.get(blocks) is 'Scope'
              blocksFiltered = this.get('viewHistory').blocksFilterSortViewed(blocks, recent);
              if (blocksFiltered.length) {
                vs[s] = blocksFiltered;
                // this.levelMeta.get(blocks[0]) is 'Blocks'
                levelMeta.set(blocksFiltered, levelMeta.get(blocks));
              }
              return vs;
            }, {});
      }
      array = Object.keys(values)
        .sort(alphanum)
        .map((key) => ({key, value : values[key]}));
      if (trace_entryValues > 1)  {
        dLog('keyValuesSorted', values, array);
      }
    }
    return array;
  }),


  /**
   * @param value to lookup in levelMeta
   * @return the dataTypeName of the values.
   */
  dataTypeName (value) {
    let
      levelMeta = this.get('levelMeta'),
    dataTypeName = valueGetType(levelMeta, value)
    ;
    return dataTypeName;
  },

  /** Based on the type of values, as recorded via levelMeta,
   * @return the dataTypeName of the values.
   * Initially, for Parent and Scope, dataTypeName referred to the type of the collection,
   * but have now added both Dataset and Datasets, so to be consistent Parent and Scope should be Parents and Scopes.
   */
  values_dataTypeName0 : computed('levelMeta', 'values', function () {
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
      (dataTypeName === 'term') ? 'record/entry-level' :
      (dataTypeName === 'trait') ? 'record/entry-node' :
      undefined;
    if (trace_entryValues > 1)
      console.log('levelComponent', values, isMap, dataTypeName, component);
    return component;
  },
  /** Based on the type of values, as recorded via levelMeta and modelName,
   * @return the name of the component which should be used to render values.
   */
  values_levelComponent : computed('values_dataTypeName', 'values', function () {
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

  /** Display .text and OntologyId of Ontology node
   * Used in .hbs : name=(compute (action 'ontologyNameId' value))
   * @return Ontology ".text [.id]"
   * @param value .type === "term" or "trait"
   */
  ontologyNameId(value) {
    let
    text =
      (value.type === 'term') ? value.text :
      (value.type === 'trait') ? ('[' + value.id + ']  ' + value.text) :
      value.id;
    return text;
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
