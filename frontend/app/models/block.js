import Ember from 'ember';
import DS from 'ember-data';
import attr from 'ember-data/attr';
// import { PartialModel, partial } from 'ember-data-partial-model/utils/model';
const { inject: { service } } = Ember;
import { A } from '@ember/array';
import { and } from '@ember/object/computed';


import { intervalMerge }  from '../utils/interval-calcs';

const trace_block = 0;
const dLog = console.debug;


const moduleName = 'models/block';


export default DS.Model.extend({
  pathsP : service('data/paths-progressive'), // for getBlockFeaturesInterval()
  blockService : service('data/block'),

  datasetId: DS.belongsTo('dataset'),
  annotations: DS.hasMany('annotation', { async: false }),
  intervals: DS.hasMany('interval', { async: false }),
  // possibly async:true when !allInitially, if needed.
  features: DS.hasMany('feature', { async: false }),
  range: attr('array'),
  scope: attr('string'),
  name: attr('string'),
  namespace: attr('string'),


  /** true when the block is displayed in the graph.
   * set by adding the block to the graph (entry-block: get()),
   * and cleared by removing the block from the display.
   */
  isViewed: false,
  /** undefined if ! isViewed, otherwise handle of Block in Stacked axis which displays this block.
   * This attribute can split out into a mixin, in that case could merge with stacks.js : Block.
   */
  view : undefined,
  
  /** when a block is selected, it is highlighted wherever it is displayed, and
   * it is used as the identifier for the block being edited in the panel
   * manage-block.hbs
   *
   * isSelected is set by clicking on the element containing the block name, in
   * the 'Aligned Maps' panel/manage-view.hbs, (map) Explorer panel at left -
   * panel/manage-explorer.hbs, and also by brushing an axis in the draw-map
   * component (can have multiple axes brushed, only the most recent one is
   * 'selected').
   */
  isSelected: false,

  /*--------------------------------------------------------------------------*/

  /** @return true if this block's dataset defined meta.paths and it is true.
   */
  showPaths : Ember.computed('datasetId.meta.paths', 'id', function () {
    let
    dataset = this.get('datasetId'),
    paths = dataset.get('meta.paths');
    // if no meta.paths, then default to paths : true.
    if (paths === undefined)
      paths = true;
    else if (paths == "false")
      paths = false;
    /** for testing, without setting up datasets with meta.paths : true, check
     * the parity of the 2nd last char of the block id, which is evenly even/odd.
     */
    if (false)
    {
      let id = this.get('id'),
      odd = id.charCodeAt(id.length - 2) & 0x1;
      paths |= odd;
      dLog(id, odd);
    }
    // dLog('showPaths', dataset, paths);
    return paths;
  }),

  /*--------------------------------------------------------------------------*/

  hasFeatures : Ember.computed('featureCount', function () {
    return this.get('featureCount') > 0;
  }),
  isData : and('isLoaded', 'hasFeatures'),

  /*--------------------------------------------------------------------------*/


  featuresLength : Ember.computed('features.[]', function () {
    let featuresLength = this.get('features.length');
    if (trace_block)
      dLog('featuresLength', featuresLength, this.get('id'));
    return featuresLength;
  }),
  /** @return undefined if ! features.length,
   * otherwise [min, max] of block's feature.value
   */
  featuresDomainUpdate : Ember.computed('features.[]', function () {
    let featuresDomain, features = this.get('features');
    if (features.length) {
      featuresDomain = features
        .mapBy('value')
        .reduce(intervalMerge, []);

      if (trace_block)
        dLog('featuresDomainUpdate', featuresDomain, this.get('id'));
    }
    return featuresDomain;
  }),
  setDomain_unused : function (domain) {
    if (domain) {
      let featuresDomain = this.get('featuresDomainValue');
      function trace (i) { if (trace_block) dLog('setDomain', featuresDomain, domain, i); }
      if (! featuresDomain) {
        trace('initialise');
        featuresDomain = A(domain);
      }
      else {
        /* if domain is outside current value then update;
         * possibly update if !=, i.e. change < and > to !=
         */
        if (featuresDomain[0] > domain[0]) {
          trace(0);
          featuresDomain[0] = domain[0];
        }
        if (featuresDomain[1] < domain[1]) {
          trace(1);
          featuresDomain[1] = domain[1];
        }
      }
    }
  },
  /** featureLimits is returned from API for all blocks initially.
   * featuresDomainUpdate is essentially equivalent.
   * If there are local changes (features added or feature values changed) then
   * featuresDomainUpdate might be used also.
   */
  featuresDomain : Ember.computed.alias('featureLimits'),

  isChartable : Ember.computed('datasetId.tags', function () {
    let tags = this.get('datasetId.tags'),
    isChartable = tags && tags.length && (tags.indexOf('chartable') >= 0);
    return isChartable;
  }),

  /*--------------------------------------------------------------------------*/

  /** generate a text name for the block, to be displayed - it should be
   * user-readable and uniquely identify the block.
   */
  datasetNameAndScope : Ember.computed('datasetId.id', 'scope', function () {
    /** This is currently the name format which is used in
     * selectedFeatures.Chromosome
     * In paths-table.js @see blockDatasetNameAndScope()
     */
    let name = (this.get('datasetId.meta.shortName') || this.get('datasetId.id')) + ':' + this.get('scope');
    return name;
  }),

  /** for the given block, generate the name format which is used in
   * selectedFeatures.Chromosome
   * Used by e.g. paths-table to access selectedFeatures - need to match the
   * block identification which is used by brushHelper() when it generates
   * selectedFeatures.
   *
   * block.get('datasetNameAndScope') may be the same value; it can
   * use shortName, and its purpose is display, whereas
   * selectedFeatures.Chromosome is for identifying the block (and
   * could be changed to blockId).
   */
  brushName : Ember.computed('name', 'datasetId', 'referenceBlock', function() {
    /** This calculation replicates the value used by brushHelper(), which draws
     * on axisName2MapChr(), makeMapChrName(), copyChrData().
     * That can be replaced by simply this function, which will then be the
     * source of the value .Chromosome in selectedFeatures.
     */
    let brushName;
    /** brushHelper() uses blockR.get('datasetId.meta.shortName') where blockR is the data block,
     * and axisName2MapChr(p) where p is the axisName (referenceBlock).
     */
    let shortName = this.get('datasetId.meta.shortName');
    /** brushes are identified by the referenceBlock (axisName). */
    let block = this.get('referenceBlock') || this;
    if (block) {
      let
        /** e.g. "IWGSC" */
        blockName = shortName || block.get('datasetId.name'),
      /** e.g. "1B" */
      scope = block.get('name');
      brushName = blockName + ':' + scope;
    }

    return brushName;
  }),


  /*--------------------------------------------------------------------------*/

  /** If the dataset of this block has a parent, return the name of that parent (reference dataset).
   * @return the reference dataset name or undefined if none
   */
  referenceDatasetName : Ember.computed('datasetId', function () {
    // copied out of referenceBlock(); could be factored
    // this function can be simply   : Ember.computed.alias('datasetId.parent.name')
    let 
      referenceBlock,
    dataset = this.get('datasetId'),
    reference = dataset && dataset.get('parent'),
    /** reference dataset */
    parent = dataset && dataset.get('parent'),
    parentName = parent && parent.get('name');  // e.g. "myGenome"

    dLog('referenceDatasetName', dataset, reference, parent, parentName, parent && parent.get('id'));

    return parentName;
  }),


  /** If the dataset of this block has a parent, lookup the corresponding reference block in that parent, matching scope.
   * @return the reference block or undefined if none
   */
  referenceBlock : Ember.computed('datasetId', 'datasetId.parent.name', 'scope', function () {
    let 
      referenceBlock,
    scope = this.get('scope'),
    dataset = this.get('datasetId'),
    reference = dataset && dataset.get('parent'),
    namespace = this.get('namespace'),
    /** reference dataset */
    parent = dataset && dataset.get('parent'),
    parentName = parent && parent.get('name');  // e.g. "myGenome"

    dLog('referenceBlock', scope, dataset, reference, namespace, parent, parentName, parent && parent.get('id'));
    if (parent)
    {
      referenceBlock = this.get('store').peekAll('block')
        .filter(function (b) {
          let scope2 = b.get('scope'),
          dataset2 = b.get('datasetId'),
          /** Comparing parent === dataset2 doesn't work because one or both may
           * be promises; refer e.g. :
           *   https://discuss.emberjs.com/t/testing-for-record-equality-in-ember-data/11433/3
           * Matching the objects directly seems slightly better than matching
           * by name, although .datasetId may be replaced by name - currently
           * being considered.
           */
          match = (parentName == dataset2.get('name')) && (scope2 == scope);
          if ((parentName == dataset2.get('name')) || (dataset2 === parent))
          {
            if (trace_block)
              dLog(dataset2.get('name'), scope2, match);
          }
          return match;})
      ;
      dLog('referenceBlock', referenceBlock);
      // expect referenceBlock.length == 0 or 1
      if (referenceBlock.length !== undefined)
        referenceBlock = referenceBlock[0] || undefined;
    }
    return referenceBlock;
  }),
  childBlocks : Ember.computed('blockService.blocksByReference', function () {
    let blocksByReference = this.get('blockService.blocksByReference'),
    childBlocks = blocksByReference && blocksByReference.get(this);
    return childBlocks || [];
  }),

  /*--------------------------------------------------------------------------*/

  axis : Ember.computed('view.axis', 'referenceBlock', function () {
    let axis = this.get('view.axis');
    let referenceBlock;
    if (! axis) {
      referenceBlock = this.get('referenceBlock');
      if (referenceBlock)
        axis = referenceBlock.get('view.axis');
    }
    if (! axis)
      dLog('block axis', this.get('id'), this.get('view'), 'no view.axis for block or referenceBlock', referenceBlock);
  }),

  /*--------------------------------------------------------------------------*/

  /** When block is added to an axis, request features, scoped by the axis
   * current position.
   */
  featuresForAxis : Ember.computed('axis', function () {
    /** This could be split out into a separate layer, concerned with reactively
     * requesting data; the layers are : core attributes (of block); derived
     * attributes (these first 2 are the above functions); actions based on
     * those other attributes (e.g. this function), similar to
     * services/data/block.js but for single-block requests.
     * models/axis-brush.js is part of this, and can be renamed to suit;
     * this function is equivalent to axis-brush.js : features().
     */
    const fnName = 'featuresForAxis';
    let blockId = this.get('id');
    let
      features = this.get('pathsP').getBlockFeaturesInterval(blockId);

    features.then(
      (result) => {
        if (trace_block)
          dLog(moduleName, fnName, result.length, blockId, this);
      },
      function (err) {
        dLog(moduleName, fnName, 'reject', err);
      }
    );

    return features;
  })


});
