import Ember from 'ember';
import DS from 'ember-data';
import attr from 'ember-data/attr';
// import { PartialModel, partial } from 'ember-data-partial-model/utils/model';
const { inject: { service } } = Ember;
// import { computed, set } from '@ember/object';
import { A } from '@ember/array';
import { and } from '@ember/object/computed';

import { task } from 'ember-concurrency';

import lodashMath from 'lodash/math';

import { intervalSize, intervalMerge, intervalOverlap }  from '../utils/interval-calcs';
import { inDomain } from '../utils/draw/interval-overlap';
import { featureCountDataProperties } from '../utils/data-types';


/*----------------------------------------------------------------------------*/

const trace_block = 0;
const dLog = console.debug;

const moduleName = 'models/block';

/*----------------------------------------------------------------------------*/

/** trace the (array) value or just the length depending on trace level. */
function valueOrLength(value) { return (trace_block > 1) ? value : value.length; }

/*----------------------------------------------------------------------------*/

const trace = 1;

export default DS.Model.extend({
  pathsP : service('data/paths-progressive'), // for getBlockFeaturesInterval()
  blockService : service('data/block'),
  auth: service('auth'),
  apiServers: service(),
  datasetService : service('data/dataset'),
  controls : service(),


  datasetId: DS.belongsTo('dataset'),
  annotations: DS.hasMany('annotation', { async: false }),
  intervals: DS.hasMany('interval', { async: false }),
  // possibly async:true when !allInitially, if needed.
  features: DS.hasMany('feature', { async: false }),
  range: attr('array'),
  scope: attr('string'),
  name: attr('string'),
  namespace: attr('string'),
  featureType: attr(),
  meta: attr(),

  /*--------------------------------------------------------------------------*/

  /** true when the block is displayed in the graph.
   * set by adding the block to the graph (entry-block: get()),
   * and cleared by removing the block from the display.
   */
  isViewed: Ember.computed('blockService.params.mapsToView.[]', {
    get () {
      // alternate dependency : 'blockService.viewed.[]'
      let isViewed = this.get('blockService').getIsViewed(this.get('id'));
      return isViewed;
    },
    set(key, value) {
      dLog('isViewed', key, value);
      this.get('blockService').setViewed(this.get('id'), value);

      return value;
    }
  }),
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

  init() {
    this._super(...arguments);

    this.set('featuresCountsResults', Ember.A());
  },

  /*--------------------------------------------------------------------------*/

  /** current view of featuresCountsResults, i.e. filtered for zoomedDomain and
   * selected for binSize suitable to zoomedDomain / yRange. */
  /** featuresCounts : undefined, */

  /** [{binSize (optional - derived), nBins, domain, result}, ... ] */
  featuresCountsResults : undefined,

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
  /** Similar to isData(), but relies on .featureCount, which may not have been received. */
  isDataCount : and('isLoaded', 'hasFeatures'),
  isData : Ember.computed('referenceBlock', 'range', function (){
    let isData = !! this.get('referenceBlock');
    if (! isData) {
      /** reference blocks have range, GMs (and child data blocks) do not. */
      isData = ! this.get('range');
    }
    return isData;
  }),

  /** is this block copied from a (secondary) server, cached on the server it was loaded from (normally the primary). */
  isCopy : Ember.computed('meta._origin', function () {
    return !! this.get('meta._origin');
  }),

  axisScope : Ember.computed('scope', 'name', 'datasetId.parentName', function () {
    let scope = this.get('datasetId.parentName') ? this.get('scope') : this.get('name');
    return scope;
  }),

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
  isSubElements : Ember.computed('datasetId.tags', function () {
    let tags = this.get('datasetId.tags'),
    isSubElements = tags && tags.length && (tags.indexOf('geneElements') >= 0);
    return isSubElements;
  }),

  /*--------------------------------------------------------------------------*/

  /*--------------------------------------------------------------------------*/

  /** these 3 functions ensureFeatureLimits(), taskGetLimits(), getLimits() (and
   * also valueOrLength()) are copied from services/data/block.js;
   * although the API is the same, this use case is for a loaded block, and the
   * services/data/ case is for all blocks or a blockId (which may not be
   * loaded).
   * This can be rationalised when re-organising the model construction.
   */

  /** get featureLimits if not already received.  After upload the block won't have
   * .featureLimits until requested
   */
  ensureFeatureLimits() {
    let limits = this.get('featureLimits');
    /** Reference blocks don't have .featureLimits so don't request it.
     * block.get('isData') depends on featureCount, which won't be present for
     * newly uploaded blocks.  Only references have .range (atm).
     */
    let range = this.get('range'),
    isData = ! range || ! range.length;
    if (! limits && isData) {
      let blocksLimitsTasks = this.get('taskGetLimits').perform();
    }
  },

  /** Call getLimits() in a task - yield the block limits result.
   */
  taskGetLimits: task(function * () {
    let blockLimits = yield this.getLimits();
    if (trace_block)
      dLog('taskGetLimits', this, valueOrLength(blockLimits));
    blockLimits.forEach((bfc) => {
      if (bfc._id !== this.get('id'))
        dLog('taskGetLimits', bfc._id);
      else {
        dLog('taskGetLimits', bfc, this);
        this.set('featureLimits', [bfc.min, bfc.max]);
        if (! this.get('featureCount'))
          this.set('featureCount', bfc.featureCount);
      }
    });

    return blockLimits;
  }).drop(),

  getLimits: function () {
    let blockId = this.get('id');
    dLog("block getLimits", blockId);

    let blockP =
      this.get('auth').getBlockFeatureLimits(blockId, /*options*/{});

    return blockP;
  },


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
    parentName = parent ? parent.get('name') : Ember.get('datasetId.parentName');  // e.g. "myGenome"

    dLog('referenceDatasetName', dataset, reference, parent, parentName, parent && parent.get('id'));

    return parentName;

  }),


  /** If the dataset of this block has a parent, lookup the corresponding reference block in that parent, matching scope.
   * The result is influenced by which of the potential references are currently viewed.
   * @return the reference block or undefined if none
   */
  referenceBlock : Ember.computed(
    'datasetId', 'datasetId.parent.name', 'scope',
    'blockService.viewed.[]', 
    function () {
      let 
        referenceBlock = this.viewedReferenceBlock() || this.referenceBlockSameServer();
      return referenceBlock;
    }),
  /** Collate the potential referenceBlocks for this block, across all servers.
   * The result is not influenced by whether the potential references are currently viewed.
   * @see referenceBlocksAllServers()
   */
  referenceBlocks : Ember.computed(
    'datasetId', 'datasetId.parent.name', 'scope',
    'block.blockValues.[]',
    'apiServers.datasetsWithServerName.[]', 
    function () {
      let 
        referenceBlocks = this.referenceBlocksAllServers(true);
      return referenceBlocks;
    }),
  /** Look for a reference block on the same server as this block.
   * caller should depend on :
   * 'datasetId', 'datasetId.parent.name', 'scope'
   */
  referenceBlockSameServer : function () {
    let 
      referenceBlock,
    scope = this.get('scope'),
    dataset = this.get('datasetId'),
    reference = dataset && dataset.get('parent'),
    namespace = this.get('namespace'),
    /** reference dataset */
    parent = dataset && dataset.get('parent'),
    parentName = parent && parent.get('name');  // e.g. "myGenome"

    if (trace_block)
      dLog('referenceBlock', scope, dataset, reference, namespace, parent, parentName, parent && parent.get('id'));
    /* parent may be a promise, with content null. parent.get('id') or 'name'
     * tests if the dataset has a parent, whether dataset is an Ember store
     * object or a (resolved) promise of one.
     */
    if (parentName)
    {
      /** it is possible that the block may be a copy from a secondary server which is not currently connected. */
      let store = this.get('apiServers').id2Store(this.get('id'));
      referenceBlock = ! store ? [] : store.peekAll('block')
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
          match = parentName && (parentName == dataset2.get('name')) && (scope2 == scope);
          if ((trace > 1) && (parentName == dataset2.get('name')) || (dataset2 === parent))
          {
            if (trace_block)
              dLog(dataset2.get('name'), scope2, match);
          }
          return match;})
      ;
      if (trace_block)
        dLog('referenceBlock', referenceBlock);
      // expect referenceBlock.length == 0 or 1
      if (referenceBlock.length !== undefined)
        referenceBlock = referenceBlock[0] || undefined;
    }
    return referenceBlock;
  },
  /** Collate the viewed reference blocks which match the .scope
   * and .datasetId or .parentName of this block.
   * @param matchParentName true means match this.datasetId.parentName, otherwise match this.datasetId.id
   * @return reference blocks, or []
   */
  viewedReferenceBlocks(matchParentName) {
    let referenceBlocks = [],
    datasetName = matchParentName ?
      this.get('datasetId.parentName') :
      this.get('datasetId.id'),
    scope = this.get('scope'),
    /** filter out self if parentName is defined */
    blockId = this.get('datasetId.parentName') && this.get('id');

    if (datasetName) {
      let mapByDataset = this.get('blockService.viewedBlocksByReferenceAndScope');
      if (mapByDataset) {
        let mapByScope = mapByDataset.get(datasetName);
        if (! mapByScope) {
          if (matchParentName)
            dLog('viewedReferenceBlock', 'no viewed parent', datasetName, scope, mapByDataset);
        } else {
          let blocks = mapByScope.get(scope);
          if (! blocks) {
            if (matchParentName)
              dLog('viewedReferenceBlock', 'no matching scope on parent', datasetName, scope, mapByScope);
          } else {
            blocks.forEach((block, i) => {
              if ((block === undefined) && (i === 0))
                dLog('viewedReferenceBlock', 'reference not viewed', datasetName, scope);
              if (scope !== block.get('scope')) {
                dLog('viewedReferenceBlock', 'not grouped by scope', block.get('id'), scope, block._internalModel.__data, datasetName);
              }
              /* viewedBlocksByReferenceAndScope() does not filter out
               * blocks[0], the reference block, even if it is not viewed, so
               * filter it out here.
               * Also filter out self if this is a child block.
               */
              else if (block.get('isViewed') && (! blockId || (block.get('id') !== blockId))) {
                referenceBlocks.push(block);
              }
            });
          }
        }
        if (trace_block > 1)
          dLog('viewedReferenceBlock', referenceBlocks, datasetName, scope);
      }
    }

    return referenceBlocks;
  },
  /** Determine if there is a viewed reference block which matches the .scope
   * and .parentName of this block.
   * @return reference block, or undefined
   */
  viewedReferenceBlock() {
    let
    parentName = this.get('datasetId.parentName'),
    scope = this.get('scope');

    let referenceBlocks = this.viewedReferenceBlocks(true),
    referenceBlock;
    referenceBlocks.forEach(function (block) {
                if (referenceBlock) {
                  // prefer original
                  if (referenceBlock.get('isCopy') && ! block.get('isCopy'))
                    referenceBlock = block;
                  else
                    dLog('viewedReferenceBlock', 'duplicate match', block.get('id'), block._internalModel.__data, parentName, scope);
                } else
                  referenceBlock = block;
    });
    return referenceBlock;
  },
  /** Mostly the same as viewedReferenceBlock(), but for the purpose of checking
   * if this is a reference and there is already a reference of the same name
   * and scope in the view.
   *
   * Determine if there is a viewed reference block which matches the .scope
   * and .datasetId.id of this block.
   * @return reference block, or undefined
   */
  viewedReferenceBlockDup() {
    const
    fnName = 'viewedReferenceBlockDup',
    datasetName = this.get('datasetId.id'),
    scope = this.get('axisScope');

    let referenceBlocksScope = this.viewedReferenceBlocks(false);

    /* The block's scope is used for grouping into axes if the block's
     * dataset has a .parentName.
     * A genetic map may have multiple blocks with the same scope, and
     * different names, e.g.  scope 1A, names 1A.1, 1A.2, ...  These
     * are linkage groups - they are known to be part of the same
     * scope but there is not sufficient linkage to relate the
     * markers.  They are displayed on separate axes (which can be
     * stacked together). So for the result of this function, they are
     * considered distinct by name (which is expected to be unique within the
     * dataset) rather than scope.
     */
    let referenceBlocks = referenceBlocksScope.filter(
      (block) => this.get('name') === block.get('name') );
    let nFiltered = referenceBlocksScope.length - referenceBlocks.length;
    if (nFiltered > 0) {
      dLog(fnName, 'omitted', nFiltered, 'distinct viewed block names with same scope; from :',
           referenceBlocksScope.map(blockInfo), datasetName, scope);
    }
    if (referenceBlocks.length) {
      dLog(fnName, 'synonomous reference viewed',
           referenceBlocks.map(blockInfo), datasetName, scope);
    }
    function blockInfo(block) { return [block.id, block.store.name, block.get('_internalModel.__data')]; };
    return referenceBlocks;
  },

  /** Determine reference blocks for this block.
   * The search is not limited to viewed blocks, and is across all connected servers.
   * @param original  if true then exclude copied / cached datasets (having .meta._origin)
   * @return array of blocks,  [] if none matching.
   */
  referenceBlocksAllServers(original) {
    let parentName = this.get('datasetId.parentName'),
    scope = this.get('scope'),
    datasetService = this.get('datasetService'),
    blocks = ! parentName ? [] :
      datasetService.datasetsForName(parentName, original)
      .reduce(function (result, d) {
        d.dataset.get('blocks').forEach(function (block) {
          /* possibly check (!original || ! block.isCopy()) here instead of
           * .datasetsForName(, original) above; for now it seems that the
           * dataset and block will be on the same server, i.e. either both are
           * copied here or both not.
           */
          if (block.get('scope') === scope) 
            result.push(block);
        });
        return result;
      }, []);
    dLog('referenceBlocksAllServers', original, parentName, scope, blocks);
    return blocks;
  },
  childBlocks : Ember.computed('blockService.blocksByReference', function () {
    let blocksByReference = this.get('blockService.blocksByReference'),
    childBlocks = blocksByReference && blocksByReference.get(this);
    return childBlocks || [];
  }),
  viewedChildBlocks : Ember.computed('childBlocks.@each.isViewed', function () {
    let childBlocks = this.get('childBlocks'),
    viewedChildBlocks = childBlocks.filterBy('isViewed');
    dLog('viewedChildBlocks', viewedChildBlocks, childBlocks);
    return viewedChildBlocks;
  }),
  unViewChildBlocks() {
    let viewedChildBlocks = this.get('viewedChildBlocks');
    if (viewedChildBlocks.length)
      this.get('blockService').setViewed(viewedChildBlocks, false);
  },


  /*--------------------------------------------------------------------------*/

  /** The domain of a reference block is provided by either .range or,
   * in the case of a genetic map, by the domain of it's features.
   */
  limits : Ember.computed('range', 'referenceBlock.limits', 'featureLimits', function () {
    /** for GM and physical reference, .referenceBlock is undefined, so this recursion is limited to 1 level. */
    let limits = this.get('range') || this.get('referenceBlock.limits') || this.get('featureLimits');
    return limits;
  }),

  /*--------------------------------------------------------------------------*/

  /** From the featuresCounts results received, filter to return the bins
   * overlapping zoomedDomain.
   * If not zoomed (no zoomedDomain), return featuresCounts.
   * @return undefined if no results or no overlaps
   */
  featuresCountsInZoom : Ember.computed(
    'featuresCountsResults.[]', 'zoomedDomain.{0,1}', 'limits',
    function () {
      let
      domain = this.get('zoomedDomain'),
      limits = this.get('limits'),
     overlaps;
     if (! domain) {
       overlaps = this.get('featuresCountsResults');
     }
     else {
       overlaps = this.featuresCountsOverlappingInterval(domain);
     }
      dLog('featuresCountsInZoom', domain, limits, overlaps && overlaps.length);
      return overlaps;
    }),
  /** From the featuresCounts results received which overlap zoomedDomain (from
   * featuresCountsInZoom), calculate their bin size and return the smallest bin
   * size.
   * @return 0 if no results or no overlaps
   */
  featuresCountsInZoomSmallestBinSize : Ember.computed('featuresCountsInZoom.[]', function () {
    let overlaps = this.get('featuresCountsInZoom') || [];
    let
    overlapsBinSizes = overlaps.map((fcs) => fcs.binSize || (intervalSize(fcs.domain) / fcs.nBins)),
    binSize = Math.min.apply(undefined, overlapsBinSizes);
    return binSize;
  }),
  /** From the featuresCounts results received, combine the counts in bins
   * overlapping zoomedDomain to return an approximation of the number of
   * features in zoomedDomain.
   * @return undefined if no overlaps
   */
  featureCountInZoom : Ember.computed('featuresCountsInZoom.[]', function () {
    let overlaps = this.get('featuresCountsInZoom') || [];
    let
    domain = this.get('zoomedDomain'),
    /** assume that the bins in each result are contiguous; use the
     * result which covers the interval best, and (secondary measure
     * if >1 cover the interval equally) has the most bins
     * First draft : sum all the overlapping counts, perhaps divide by
     * number of overlapping results.
     *
     * interval is passed to getBlockFeaturesCounts(), so result type
     * is featureCountDataProperties.
     */
    counts = overlaps.map((fcs) => fcs.result.reduce( (sum, fc, i) => {
      let
      binInterval = featureCountDataProperties.datum2Location(fc),
      /** count within bin */
      binCount = featureCountDataProperties.datum2Value(fc);
      if (domain) {
        let
        overlap = intervalOverlap([binInterval, domain]);
        if (overlap) {
          let
          binSize = intervalSize(binInterval),
          ratio = binSize ? intervalSize(overlap) / binSize : 1;
          sum += ratio * binCount;
          if (i % 64 === 0)  {
            dLog('featureCountInZoom map', binInterval, overlap, ratio, binCount, sum, i);
          }
        }
      } else {
        sum += binCount;
      }
      return sum;
    }, 0)),
    /** number of results which overlap. */
    overlapsLength = overlaps && overlaps.length,
    sum = lodashMath.sum(counts),
    average = sum / (overlapsLength || 1);
    dLog('featureCountInZoom', average, sum, counts.length, overlapsLength);
    return average;
  }),
  /** Filter all featuresCounts API results for this block, for those overlapping interval.
   * @return array  [{nBins, domain, result}, ... ]
   * @param interval	[from, to]
   * not undefined;  if zoomedDomain is not defined, this function is not called.
   */
  featuresCountsOverlappingInterval(interval) {
    let
    featuresCounts = this.get('featuresCountsResults') || [],
    overlaps = featuresCounts.reduce(
      (result, fcs) => {
        if (inDomain(fcs.domain, interval)) {
          let
          filtered = Object.assign({}, fcs);
          filtered.result = fcs.result.filter(
            (fc) => {
              let loc = featureCountDataProperties.datum2Location(fc);
              return inDomain(loc, interval); }),
          result.push(filtered);
        }
        return result;
      }, []);
    dLog('featuresCountsOverlappingInterval', featuresCounts, overlaps);
    return overlaps;
  },

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

  zoomedDomain : Ember.computed.alias('axis.axis1d.zoomedDomain'),
  zoomedDomainDebounced : Ember.computed.alias('axis.axis1d.zoomedDomainDebounced'),
  zoomedDomainThrottled : Ember.computed.alias('axis.axis1d.zoomedDomainThrottled'),

  /** @return true if the axis on which this block is displayed is zoomed out past the point
   * that the number of features in the block within zoomedDomain is > featuresCountsThreshold.
   * @desc
   * This is used to select whether axis-charts featuresCounts or axis-tracks
   * are displayed for this block.
   */
  isZoomedOut : Ember.computed('zoomedDomainDebounced.{0,1}', function () {
    let
    count = this.get('featureCountInZoom'),
    featuresCountsThreshold = this.get('featuresCountsThreshold'),
    out  = (count > featuresCountsThreshold);
    dLog('isZoomedOut', out, this.get('id'), count, featuresCountsThreshold);
    return out;
  }),


  /*--------------------------------------------------------------------------*/

  featuresCountsThreshold : Ember.computed.alias('controls.view.featuresCountsThreshold'),

  /** When block is added to an axis, request features, scoped by the axis
   * current position.
   * As used in axis-tracks : when axis is open/split, request features in
   * response to, and as defined by, zoom changes.
   */
  featuresForAxis : Ember.computed('axis', 'zoomedDomainDebounced.{0,1}', function () {
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
    count = this.get('featureCountInZoom'),
    featuresCountsThreshold = this.get('featuresCountsThreshold');
    let features;

    /** if featuresCounts not yet requested then count is 0 */
    if ((this.featuresCounts === undefined) || (count > featuresCountsThreshold)) {
      let
      minSize = this.get('featuresCountsInZoomSmallestBinSize'),
      domain = this.get('zoomedDomain') || this.get('limits'),
      axis = this.get('axis'),
      yRange = (axis && axis.yRange()) || 800,
      /** bin size of result with smallest bins, in pixels as currently viewed on screen. */
      minSizePx = yRange * minSize / intervalSize(domain);
      /** minSize === 0 indicate no featuresCounts overlapping this zoomedDomain. */
      if ((minSizePx === 0) || (minSizePx > 20))  /* px */ {
        /* request summary / featuresCounts if there are none for block,
         * or if their bins are too big */
        let blockService = this.get('blockService'),
        blocksSummaryTasks = blockService.get('getBlocksSummary').apply(blockService, [[blockId]]);
      }
      // features is undefined
    } else {
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
    }

    return features;
  })


});
