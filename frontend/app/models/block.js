import { computed } from '@ember/object';
import { inject as service } from '@ember/service';
import Model, { attr, belongsTo, hasMany } from '@ember-data/model';
// import { computed, set } from '@ember/object';
import { observer } from '@ember/object';
import { A } from '@ember/array';
import { and, alias } from '@ember/object/computed';
import { debounce, throttle } from '@ember/runloop';

import { task } from 'ember-concurrency';

import lodashMath from 'lodash/math';

import {
  intervalSize,
  intervalMerge,
  intervalOverlap,
  intervalOverlapCoverage
} from '../utils/interval-calcs';
import { binEvenLengthRound } from '../utils/draw/interval-bins';
import { subInterval, overlapInterval } from '../utils/draw/zoomPanCalcs';
import {
  featuresCountsResultsCheckOverlap,
  featuresCountsResultsMerge,
  featuresCountsResultsFilter,
  featuresCountsResultsTidy,
 } from '../utils/draw/featuresCountsResults';

import { featureCountDataProperties } from '../utils/data-types';

import { stacks } from '../utils/stacks';


/*----------------------------------------------------------------------------*/

const trace_block = 0;
const dLog = console.debug;

const moduleName = 'models/block';

/*----------------------------------------------------------------------------*/

/** trace the (array) value or just the length depending on trace level. */
function valueOrLength(value) { return (trace_block > 1) ? value : value.length; }

/*----------------------------------------------------------------------------*/

const trace = 1;

export default Model.extend({
  pathsP : service('data/paths-progressive'), // for getBlockFeaturesInterval()
  blockService : service('data/block'),
  auth: service('auth'),
  apiServers: service(),
  datasetService : service('data/dataset'),
  controls : service(),
  queryParams: service('query-params'),

  urlOptions : alias('queryParams.urlOptions'),


  datasetId: belongsTo('dataset'),
  annotations: hasMany('annotation', { async: false }),
  intervals: hasMany('interval', { async: false }),
  // possibly async:true when !allInitially, if needed.
  features: hasMany('feature', { async: false }),
  range: attr('array'),
  scope: attr('string'),
  name: attr('string'),
  namespace: attr('string'),
  featureType: attr(),
  _meta: attr(),

  /*--------------------------------------------------------------------------*/

  /** true when the block is displayed in the graph.
   * set by adding the block to the graph (entry-block: get()),
   * and cleared by removing the block from the display.
   */
  isViewed: computed('blockService.params.mapsToView.[]', {
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

    this.set('featuresCountsResults', A());
  },

  /*--------------------------------------------------------------------------*/

  /** current view of featuresCountsResults, i.e. filtered for zoomedDomain and
   * selected for binSize suitable to zoomedDomain / yRange. */
  /** featuresCounts : undefined, */

  /** [{binSize (optional - derived), nBins, domain, result}, ... ] */
  featuresCountsResults : undefined,

  /*--------------------------------------------------------------------------*/

  /** @return true if this block's dataset defined _meta.paths and it is true.
   * and ! .isSNP
   */
  showPaths : computed(
    'datasetId._meta.paths', 'id',
    'featuresCountIncludingZoom', 'featuresCount',
    function () {
    let
    dataset = this.get('datasetId'),
    paths = dataset.get('_meta.paths');
    // if no _meta.paths, then default to paths : true.
    /** if paths === false, this value is returned.  This is the usual case,
     * i.e. value in db is Boolean not string. */
    if (paths === undefined)
      paths = true;
    else if (paths == "false")
      paths = false;
    /** for testing, without setting up datasets with _meta.paths : true, check
     * the parity of the 2nd last char of the block id, which is evenly even/odd.
     */
    if (false)
    {
      let id = this.get('id'),
      odd = id.charCodeAt(id.length - 2) & 0x1;
      paths |= odd;
      dLog(id, odd);
    }
    /* don't request paths for HighDensity SNPs until zoomed in to small scale.
     * The comparison < 5e4 will be false until .featureCount or
     * .featuresCountsResults are received, i.e. while
     * featuresCountIncludingZoom is undefined.
     *
     * 
     * Currently the high density data does not have symbolic names
     * (just chr:location) so paths via direct and aliases are not
     * applicable.  It is tagged HighDensity, but we should add a
     * separate tag to indicate the lack of a feature name.
     * So disable paths if tagged HighDensity.
     */
    paths &&= ! this.get('isHighDensity') && (this.get('featuresCountIncludingZoom') < 5e4);
    // dLog('showPaths', dataset, paths);
    return paths;
  }),

  /*--------------------------------------------------------------------------*/

  hasFeatures : computed('featureCount', function () {
    /** featureValueCount > 0 implies featureCount > 0.
     * Could also use .featuresCountsResults - if any non-zero counts then block has features.  */
    let count = this.get('featureCount') || this.get('featureValueCount');
    return count > 0;
  }),
  /** Similar to isData(), but relies on .featureCount, which may not have been received. */
  isDataCount : and('isLoaded', 'hasFeatures'),
  isData : computed('referenceBlock', 'range', function (){
    let isData = !! this.get('referenceBlock');
    if (! isData) {
      /** reference blocks have range, GMs (and child data blocks) do not. */
      isData = ! this.get('range');
    }
    return isData;
  }),
  currentDomain : computed('referenceBlock', 'range',  function () {
    let domain = this.get('zoomedDomain');
    if (! domain)  {
      let referenceBlock = this.get('referenceBlock');
      if (referenceBlock) {
        domain = referenceBlock.get('range');
      } else {
        domain = this.get('featuresDomain');
      }
    }
    return domain;
  }),

  /** is this block copied from a (secondary) server, cached on the server it was loaded from (normally the primary). */
  isCopy : computed('_meta._origin', function () {
    return !! this.get('_meta._origin');
  }),

  axisScope : computed('scope', 'name', 'datasetId.parentName', function () {
    let scope = this.get('datasetId.parentName') ? this.get('scope') : this.get('name');
    return scope;
  }),

  /*--------------------------------------------------------------------------*/


  featuresLength : computed('features.[]', function () {
    let featuresLength = this.get('features.length');
    if (trace_block)
      dLog('featuresLength', featuresLength, this.get('id'));
    return featuresLength;
  }),
  featuresLengthUpdate() {
    let featuresLength = this.get('features.length');
    if (trace_block)
      dLog('featuresLengthUpdate', featuresLength, this.get('id'));
    this.set('featuresLengthDebounced', featuresLength);
  },
  featuresLengthUpdateThrottle() {
    let featuresLength = this.get('features.length');
    if (trace_block)
      dLog('featuresLengthUpdateThrottle', featuresLength, this.get('id'));
    this.set('featuresLengthThrottled', featuresLength);
  },
  featuresLengthObserver : observer('features.length', function () {
    debounce(this, this.featuresLengthUpdate, 200);
    throttle(this, this.featuresLengthUpdateThrottle, 1000, true);
    let featuresLength = this.get('features.length');
    if (trace_block > 1)
      dLog('featuresLengthObserver', featuresLength, this.get('id'));
    return featuresLength;
  }),

  /** @return undefined if ! features.length,
   * otherwise [min, max] of block's feature.value
   */
  featuresDomainUpdate : computed('featuresLengthDebounced', function () {
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
  /** featureLimits is returned from API for all blocks initially.
   * featuresDomainUpdate is essentially equivalent.
   * If there are local changes (features added or feature values changed) then
   * featuresDomainUpdate might be used also.
   * Used in axis-1d : @see dataBlocksDomains().
   */
  featuresDomain : alias('featureLimits'),

  /** @return true if the parent dataset of this block has the given tag.
   * @desc This can be extended to provided inheritance : first lookup
   * this.get('tags'), and if tag is not found, then lookup
   * .datasetId.tags
   */
  hasTag : function (tag) {
    let tags = this.get('datasetId.tags'),
    has = tags && tags.length && (tags.indexOf(tag) >= 0);
    return has;
  },
  isSNP : computed('datasetId.tags', function () {
    let isSNP = this.hasTag('SNP');
    return isSNP;
  }),
  isHighDensity : computed('datasetId.tags', function () {
    let isHighDensity = this.hasTag('HighDensity');
    return isHighDensity;
  }),
  /** hasTag() can now be used in isChartable() and isSubElements() also.
   */
  isChartable : computed('datasetId.tags', function () {
    let tags = this.get('datasetId.tags'),
    isChartable = tags && tags.length && (tags.indexOf('chartable') >= 0);
    return isChartable;
  }),
  isSubElements : computed('datasetId.tags', function () {
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
     * block.get('isDataCount') depends on featureCount, which won't be present for
     * newly uploaded blocks.  Only references have .range (atm).
     * Could use block.get('isData') here;  this (!range) seems equivalent.
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
    let blockLimits = yield this.getLimits()
        .catch((err) => {
          dLog('taskGetLimits', err);
          return [];
        });
    if (trace_block)
      dLog('taskGetLimits', this, valueOrLength(blockLimits));
    blockLimits.forEach((bfc) => {
      if (bfc._id !== this.get('id'))
        dLog('taskGetLimits', bfc._id);
      else {
        dLog('taskGetLimits', bfc, this);
        this.set('featureLimits', [bfc.min, bfc.max]);
        if (! this.get('featureValueCount'))
          this.set('featureValueCount', bfc.featureCount);
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
  datasetNameAndScope : computed('datasetId.id', 'scope', function () {
    /** This is currently the name format which is used in
     * selectedFeatures.Chromosome
     * In paths-table.js @see blockDatasetNameAndScope()
     */
    let name = this.get('datasetId.shortNameOrName') + ':' + this.get('scope');
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
  brushName : computed('name', 'datasetId', 'referenceBlock', function() {
    /** This calculation replicates the value used by brushHelper(), which draws
     * on axisName2MapChr(), makeMapChrName(), copyChrData().
     * That can be replaced by simply this function, which will then be the
     * source of the value .Chromosome in selectedFeatures.
     */
    let brushName;
    /** brushHelper() uses blockR.get('datasetId._meta.shortName') where blockR is the data block,
     * and axisName2MapChr(p) where p is the axisName (referenceBlock).
     */
    let shortName = this.get('datasetId._meta.shortName');
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
  referenceDatasetName : computed('datasetId', function () {
    // copied out of referenceBlock(); could be factored
    // this function can be simply   : Ember.computed.alias('datasetId.parent.name')
    let 
      referenceBlock,
    dataset = this.get('datasetId'),
    reference = dataset && dataset.get('parent'),
    /** reference dataset */
    parent = dataset && dataset.get('parent'),
    /** if parent may be undefined because the secondary server with parent is
     * not connected; in this case this.get('datasetId.parentName') can be used. */
    parentName = parent ? parent.get('name') : this.get('datasetId.parentName');  // e.g. "myGenome"

    dLog('referenceDatasetName', dataset, reference, parent, parentName, parent && parent.get('id'));

    return parentName;

  }),


  /** @return the block of the axis on which this block will be displayed.
   * @desc GMs have referenceBlock === undefined, and they are the block of their axis-1d.
   */
  referenceBlockOrSelf : computed('referenceBlock',
    function () {
      return this.get('referenceBlock') || this;
    }),
  
  /** If the dataset of this block has a parent, lookup the corresponding reference block in that parent, matching scope.
   * The result is influenced by which of the potential references are currently viewed.
   * @return the reference block or undefined if none
   */
  referenceBlock : computed(
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
  referenceBlocks : computed(
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
      let
      apiServers = this.get('apiServers'),
      /** server which this block was received from.
       *
       * block id is generally unique across servers, but a reference block may
       * be copied from another server for use as test data, which would cause
       * id2Server[] to return the most-recently-connected server with that
       * block id, whereas servers[this.store.name] will handle that OK.
       * Otherwise these 2 expressions are equivalent.
       */
      server = apiServers.servers[this.store.name] || apiServers.id2Server[this.id];

      /** this function is called for each block, e.g. when view / un-view a
       * block. Scanning all blocks is becoming too slow, so an alternate
       * algorithm based on blocksByReferenceAndScope() is used.
       */
      if (true) {
        let 
        /** if server is not connected then `server` is undefined. */
        map = server && server.get('blocksByReferenceAndScope'),
        scopes = map && map.get(parentName),
        /** blocks[0] may be undefined, e.g. when the reference is on another server which is not connected. */
        blocks = scopes && scopes.get(scope);
        /** b.isData uses .referenceBlock, which may recurse to here, so use
         * direct attributes of block to indicate whether it is reference / data
         * block. */
        referenceBlock = blocks && blocks.filter((b) => b && (!!b.range || ! (b.featureValueCount || b.featureLimits)));
      } else {
        let blocks;
        if (false) {
      let
      /** Alternative method of getting the array of blocks.  performance seems the same.
      */
      store = this.get('apiServers').id2Store(this.get('id')),
      blocks = ! store ? [] : store.peekAll('block');
        } else {
          let
      /** all blocks from the same server as `this`. */
      blocks = server && server.datasetsBlocks && server.datasetsBlocks.flatMap((d) => d.blocks.map((b) => b));
        }
      referenceBlock = blocks && blocks
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
      }
      if (trace_block)
        dLog('referenceBlock', referenceBlock);
      // expect referenceBlock.length == 0 or 1
      if (referenceBlock && referenceBlock.length !== undefined)
        referenceBlock = referenceBlock[0] || undefined;
    }
    return referenceBlock;
  },
  /** Collate the viewed reference blocks which match the .scope
   * and .datasetId or .parentName of this block.
   * This function may be called when !this.isViewed - see referenceBlock().
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
          if (matchParentName && (this.isViewed || trace_block > 1)) {
            dLog('viewedReferenceBlock', 'no viewed parent', datasetName, scope, mapByDataset);
          }
        } else {
          let blocks = mapByScope.get(scope);
          if (! blocks) {
            if (matchParentName && (this.isViewed || trace_block > 1)) {
              dLog('viewedReferenceBlock', 'no matching scope on parent', datasetName, scope, mapByScope);
            }
          } else {
            blocks.forEach((block, i) => {
              if ((block === undefined) && (i === 0)) {
                dLog('viewedReferenceBlock', 'reference not viewed', datasetName, scope);
              } else if ((block === undefined)) {
                dLog('viewedReferenceBlock', 'block undefined', datasetName, scope);
              } else if (scope !== block.get('scope')) {
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
        else {
          console.warn('viewedReferenceBlock', 'duplicate match', block.get('id'), block._internalModel.__data, parentName, scope);
        }
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
   * @param original  if true then exclude copied / cached datasets (having ._meta._origin)
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
  childBlocks : computed('blockService.blocksByReference', function () {
    let blocksByReference = this.get('blockService.blocksByReference'),
    childBlocks = blocksByReference && blocksByReference.get(this);
    return childBlocks || [];
  }),
  viewedChildBlocks : computed('childBlocks.@each.isViewed', function () {
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
  limits : computed('range', 'referenceBlock.limits', 'featureLimits', function () {
    /** for GM and physical reference, .referenceBlock is undefined, so this recursion is limited to 1 level. */
    let limits = this.get('range') || this.get('referenceBlock.limits') || this.get('featureLimits');
    return limits;
  }),

  /*--------------------------------------------------------------------------*/

  brushedDomain : computed(
    'axis1d.axisBrushComp.block.brushedDomain.{0,1}',
    'axis1d.brushedDomain.{0,1}',
    function() {
      let brushedDomain = this.get('axis1d.axisBrushComp.block.brushedDomain') ||
          this.get('axis1d.brushedDomain');
      return brushedDomain;
    }),

  featuresCountIncludingBrush : computed(
    'featuresCountsResults.[]',
    'featureCountInBrush', 'brushedDomain.{0,1}' /* -Debounced */, 'limits',
    function () {
      let
      count = this.get('axis1d.brushed') ?
        (this.featuresCountsResults.length ? this.get('featureCountInBrush') : undefined ) :
        this.featureCount;
      if (trace_block > 1)
        dLog('featuresCountIncludingBrush', count);
      return count;
    }),

  /** @return the features count within zoomedDomain, or if there is no zoom,
   * i.e. zoomedDomain is undefined, then simply return .featureCount
   */
  featuresCountIncludingZoom : computed(
    'featuresCountsResults.[]',
    'featureCountInZoom',
    '{zoomedDomainDebounced,zoomedDomainThrottled}.{0,1}',
    'limits',
    function () {
      let
      count = this.get('zoomedDomain') ?
        (this.featuresCountsResults.length ? this.get('featureCountInZoom') : undefined ) :
        this.featureCount;
      if (trace_block > 1)
        dLog('featuresCountIncludingZoom', count);
      return count;
    }),

  /** Same as featuresCountsInZoom(), but for the brushedDomain instead of the zoomedDomain
   */
  featuresCountsInBrush : computed(
    'featuresCountsResults.[]', 'brushedDomain.{0,1}' /* -Debounced */, 'limits',
    function () {
      let
      domain = this.get('brushedDomain'),
      overlaps;
      if (! domain) {
        overlaps = this.get('featuresCountsResults');
      }
      else {
        overlaps = this.featuresCountsOverlappingInterval(domain);
      }
      if (trace_block > 1)
        dLog('featuresCountsInBrush', domain, this.limits, overlaps && overlaps.length);
      return overlaps;
    }),
  /** From the featuresCounts results received, filter to return the bins
   * overlapping zoomedDomain.
   * If not zoomed (no zoomedDomain), return featuresCountsResults.
   * @return undefined if no results or no overlaps
   * Result form is the same as featuresCountsResults, i.e.
   * [ {binSize, nBins, domain: Array(2), result: Array}, ... ]
   */
  featuresCountsInZoom : computed(
    'featuresCountsResults.[]',
    '{zoomedDomainDebounced,zoomedDomainThrottled}.{0,1}',
    'limits',
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
      if (trace_block > 1)
        dLog('featuresCountsInZoom', domain, limits, overlaps && overlaps.length);
      return overlaps;
    }),
  /** From the featuresCounts results received which overlap zoomedDomain (from
   * featuresCountsInZoom), calculate their bin size and return the smallest bin
   * size.
   * @return 0 if no results or no overlaps
   */
  featuresCountsInZoomSmallestBinSize : computed('featuresCountsInZoom.[]', function () {
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
  featureCountInZoom : computed('featuresCountsInZoom.[]', function () {
    let overlaps = this.get('featuresCountsInZoom') || [];
    let
    domain = this.get('zoomedDomain'),
    count = this.featureCountInInterval(overlaps, domain, 'Zoom');
    return count;
  }),
  featureCountInBrush : computed('featuresCountsInBrush.[]', function () {
    let overlaps = this.get('featuresCountsInBrush') || [];
    let
    domain = this.get('brushedDomain'),
    count = this.featureCountInInterval(overlaps, domain, 'Brush');
    return count;
  }),
  /** Use featuresCounts results to calculate featureCount in the given interval.
   * @param overlaps  featuresCounts results which overlap the domain
   * @param domain	[start,end] or if undefined then the whole count of all bins are summed.
   * @param intervalName  used only in log message
   */
  featureCountInInterval(overlaps, domain, intervalName) {
    let
    /** assume that the bins in each result are contiguous; use the
     * result which covers the interval best, and maybe later : (secondary measure
     * if >1 cover the interval equally) has the smallest binSize.
     *
     * The current algorithm determines the 2 results (smallestOver1I,
     * largestUnder1I) whose coverage most closely brackets 1, i.e. the
     * preference is for a coverage slightly greater than 1, and if none cover
     * the whole of the domain, then the result which most nearly covers the
     * domain.
     */
    coverage = overlaps.map((fcs) => this.featureCountResultCoverage(fcs, domain)),
    smallestOver1I = coverage.reduce((index, cov, i) => {
      if ((cov >= 1) && ((index === -1) || (cov < coverage[index]))) { index = i; } return index; },
      -1),
    largestUnder1I = coverage.reduce((index, cov, i) => {
      if ((cov <= 1) && ((index === -1) || (cov > coverage[index]))) { index = i; } return index; },
      -1),
    selectedOverlapI = (smallestOver1I !== -1) ? smallestOver1I : largestUnder1I,
    selectedOverlap = (selectedOverlapI === -1) ? undefined : overlaps[selectedOverlapI],
    count = selectedOverlap && this.featureCountResultInZoom(selectedOverlap, domain);
    if (trace_block > 1)
      dLog('featureCountInZoom', intervalName, overlaps, domain, coverage, smallestOver1I, largestUnder1I, selectedOverlapI, selectedOverlap, count);
    return count;
  },
  /** Determine how well this result covers the given domain.
   * via overlap size / domain size
   * @return 0 if there is no overlap
   */
  featureCountResultCoverage(fcs, domain) {
    let coverage = intervalOverlapCoverage(fcs.domain, domain);
    return coverage;
  },
  /** Sum the counts of bins which overlap the domain
   * Used for both zoomedDomain and brushedDomain.
   * @param domain	[start,end] or if undefined then the whole count of all bins are summed.
   */
  featureCountResultInZoom(fcs, domain) {
    let count = 
    fcs.result.reduce( (sum, fc, i) => {
      /** an interval parameter is passed to getBlockFeaturesCounts(), so result
       * type of the request is featureCountDataProperties.
       */
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
          if ((trace_block > 1) && (i % 64 === 0))  {
            dLog('featureCountInZoom map', binInterval, overlap, ratio, binCount, sum, i);
          }
        }
      } else {
        sum += binCount;
      }
      return sum;
    }, 0);
    return count;
  },
  /** Used to decide if a featuresCounts result covers enough of the
   * zoomedDomain to be chosen for display.
   * @return true if the fcs_domain spans interval, or at least most of it (featuresCountsCover)
   * @param interval	[from, to]  zoomedDomain
   * @param fcs_domain  domain of the featuresCounts api request/result
   */
  almostSubInterval(interval, fcs_domain) {
    const featuresCountsCoverage = 0.3;
    let enough = subInterval(interval, fcs_domain);
    if (! enough) {
      let coverage = intervalOverlapCoverage(fcs_domain, interval);
      enough = coverage > featuresCountsCoverage;
    }
    return enough;
  },
  /** Filter all featuresCounts API results for this block, for those overlapping interval,
   * or completely spanning the interval, depending on fcLevels.
   * @return array  [{nBins, domain, result}, ... ]
   * @param interval	[from, to]
   * not undefined;  if zoomedDomain is not defined, this function is not called.
   */
  featuresCountsOverlappingInterval(interval) {
    let
    fcLevels = this.get('urlOptions.fcLevels'),
    overlapFn = fcLevels ? overlapInterval : this.almostSubInterval,
    featuresCounts = this.get('featuresCountsResults') || [],
    overlaps = featuresCounts.reduce(
      (result, fcs) => {
        if (overlapFn(interval, fcs.domain)) {
          let
          filtered = Object.assign({}, fcs);
          filtered.result = fcs.result.filter(
            (fc) => {
              let loc = featureCountDataProperties.datum2Location(fc);
              return overlapInterval(loc, interval); }),
          result.push(filtered);
        }
        return result;
      }, []);
    if (trace_block > 1)
      dLog('featuresCountsOverlappingInterval', featuresCounts, overlaps);
    return overlaps;
  },

  /*--------------------------------------------------------------------------*/

  /**  @return undefined if this block is not the referenceBlock of an axis1d
   */
  referencedAxis1d : computed(
    'blockService.axis1dReferenceBlocks.[]',
    function () {
      let
      axisBlocks = this.get('blockService.axis1dReferenceBlocks'),
      /** could calculate a hash in axis1dReferenceBlocks and lookup via that,
       * but this is a small array to scan. */
      axis1d = axisBlocks.find((ab) => ab[1] === this);
      axis1d = axis1d && axis1d[0];
      return axis1d;
    }),

  axis1d : computed(
    'referencedAxis1d', 'referenceBlock.referencedAxis1d',
    function () {
      let axis1d = this.get('referencedAxis1d') || this.get('referenceBlock.referencedAxis1d');
      let a1Check = this.verify_axis1d();
      if (axis1d !== a1Check) {
        dLog('axis1d', axis1d, a1Check);
      }
      return axis1d;
    }),
  /** Check result of axis1d().
   * This can't be used as a CP because it would need to depend on 
   * blockService.axes1d.axis1dArray.@each.viewedBlocks.length.
   */
  verify_axis1d() {
    let axis1d;
    if (this.isViewed) {
      let
      axes1d = this.get('blockService.axes1d.axis1dArray');
      axis1d = axes1d.find((a1) => !a1.isDestroying && a1.viewedBlocks.find((b) => b === this));
      if (trace_block > 1) {
        dLog('axis1d', axis1d, axes1d, this.id, this.get('axis.axis1d'));
      }
    }
    return axis1d;
  },

  axis : computed(/*'view.axis'*/'isViewed', 'referenceBlock', function () {
    let axesP = stacks.axesP;
    let axis = this.get('view.axis') || axesP[this.get('id')];
    let referenceBlock;
    if (! axis) {
      referenceBlock = this.get('referenceBlock');
      if (referenceBlock)
        axis = referenceBlock.get('view.axis') || axesP[referenceBlock.get('id')];
    }
    if (! axis)
      dLog('block axis', this.get('id'), this.get('view'), 'no view.axis for block or referenceBlock', referenceBlock, axesP);
    return axis;
  }),

  zoomedDomain : alias('axis1d.zoomedDomain'),
  zoomedDomainDebounced : alias('axis1d.zoomedDomainDebounced'),
  zoomedDomainThrottled : alias('axis1d.zoomedDomainThrottled'),

  /** @return true if the axis on which this block is displayed is zoomed out past the point
   * that the number of features in the block within zoomedDomain is > featuresCountsThreshold.
   * Return undefined if .featuresCountIncludingZoom is undefined,
   * otherwise true or false.
   * @desc
   * This is used to select whether axis-charts featuresCounts or axis-tracks
   * are displayed for this block.
   */
  isZoomedOut : computed(
    'featuresCountIncludingZoom',
    'zoomedDomainDebounced.{0,1}',
    'featuresCounts.[]',
    'featuresCountsResults.[]',
    'featuresCountsThreshold',
    function () {
    let
    count = this.get('featuresCountIncludingZoom'),
    featuresCountsThreshold = this.get('featuresCountsThreshold'),
    out  = (count === undefined) ? undefined : (count > featuresCountsThreshold);
    if (trace_block > 1)
      dLog('isZoomedOut', out, this.get('id'), count, featuresCountsThreshold);
    return out;
  }),

  /** Same as axis-1d .isZoomedRightOut, except this evaluates just this block.
   * Refer to the comment in axis-1d : @see isZoomedRightOut()
   */
  isZoomedRightOut() {
    let out = ! this.axis1d.zoomed &&
        ! (this.featureCount <= this.get('featuresCountsThreshold'));
    dLog('isZoomedRightOut', out, this.featureCount, this.get('featuresCountsThreshold'));
    return out;
  },

  /** @return true if features should be requested in response to axis brush,
   * and displayed in features table as axis red circles.
   */
  isBrushableFeatures : computed(
    'isZoomedOut', 'featuresCountIncludingBrush', 'featuresCountsThreshold',
    function () {
      let brushable = ! this.get('isZoomedOut') ||
          (! this.get('isHighDensity') && (this.get('featuresCountIncludingBrush') <= this.get('featuresCountsThreshold')));
      return brushable;
    }),

  /*--------------------------------------------------------------------------*/

  /** @return current .zoomedDomain, or .limits
   * @desc related : currentDomain()
   */
  getDomain() {
    let
    domain = this.get('zoomedDomain') || this.get('limits');
    return domain;
  },
  /** @return current yRange of .axis
   */
  getRange() {
    let
    axis = this.get('axis'),
    yRange = (axis && axis.yRange()) || 800;
    return yRange;
  },

  /** Express a binSize relative to screen pixels, looking up current domain, yRange. */
  pxSize2(binSize) {
    return this.pxSize(binSize, this.getRange(), this.getDomain());
  },
  /** Express a binSize relative to screen pixels, using yRange and domain. */
  pxSize(binSize, yRange, domain) { return yRange * binSize / intervalSize(domain); },


  /*--------------------------------------------------------------------------*/

  featuresCountsThreshold : alias('controls.view.featuresCountsThreshold'),

  /** When block is added to an axis, request features, scoped by the axis
   * current position.
   * As used in axis-tracks : when axis is open/split, request features in
   * response to, and as defined by, zoom changes.
   */
  featuresForAxis : computed(
    'axis', 'zoomedDomainDebounced.{0,1}',
    'featuresCountIncludingZoom',
    'featuresCountsThreshold',
    'featuresCountsInZoomSmallestBinSize',
    'limits',
    'featuresCountsResults.[]',
    'isZoomedOut',
    // used in data/block.js:getSummary()
    'blockService.featuresCountsNBins',
    function () {
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
    count = this.get('featuresCountIncludingZoom'),
    isZoomedOut = this.get('isZoomedOut'),
    featuresCountsThreshold = this.get('featuresCountsThreshold');
    let features;
    dLog('featuresForAxis', isZoomedOut, count, featuresCountsThreshold, this.get('zoomedDomain'), this.get('zoomedDomainDebounced'));

    /** if the block has chartable data, get features regardless; may also request featuresCounts. */
    /** can use isZoomedOut here instead, e.g. (isZoomedOut === true)  */
    if (this.get('isChartable') || ((count !== undefined) && (count <= featuresCountsThreshold))) {
      this.getFeatures(blockId);
    }
    /** if featuresCounts not yet requested then count is undefined
     * Equivalent to check if .featuresCountsResults.length === 0.
     */
    if ((this.featuresCounts === undefined) || ((count === undefined) || (count > featuresCountsThreshold))) {
      let
      minSize = this.get('featuresCountsInZoomSmallestBinSize'),
      domain = this.getDomain(),
      yRange = this.getRange(),
      /** bin size of result with smallest bins, in pixels as currently viewed on screen. */
      minSizePx = this.pxSize(minSize, yRange, domain);
      /** When the smallest bins within the current view
       * (featuresCountsInZoomSmallestBinSize) are displayed with pixel size >
       * binPxThreshold, then request finer-resolution bins.
       */
      const binPxThreshold = 20;
      let nBins = this.get('blockService.featuresCountsNBins'),
      requestedSize = yRange / nBins,
      threshold = Math.min(binPxThreshold, requestedSize);
      /** minSize === 0 indicate no featuresCounts overlapping this zoomedDomain. */
      if ((minSizePx === 0) || (minSizePx > threshold))  /* px */ {
        /* request summary / featuresCounts if there are none for block,
         * or if their bins are too big */
        /** Don't request if there is already a result matching these params. */
        let match = this.featuresCountsResultsSearch(domain, nBins);
        if (! match)
        {
          let blockService = this.get('blockService'),
          blocksSummaryTasks = blockService.get('getBlocksSummary').apply(blockService, [[blockId]]);
        }
      }
      // features is undefined
    }

    return features;
  }),
  getFeatures(blockId) {
    const fnName = 'getFeatures';
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
  },

  /** Search in current results for a result which meets the requirements of domain and nBins.
   * The result domain should cover the current domain.
   * Matching is done on binSize which is derived from nBins, using the same
   * function which the backend will use if a request is sent with these
   * parameters.
   * @param domain  zoomedDomain || limits
   * @param nBins from featuresCountsNBins
   */
  featuresCountsResultsSearch(domain, nBins) {
    let 
    lengthRounded = binEvenLengthRound(domain, nBins),
    result = this.get('featuresCountsResults')
    // based on similar block-view.js:selectFeaturesCountsResults(): betterResults
      .find(
        (fc) => {
          let found =
              // if the domains are equal, that is considered a match.
              (lengthRounded === fc.binSize) && subInterval(domain, fc.domain);
          if (found) {
            if (trace_block > 1)
              dLog('featuresCountsResultsSearch', domain.toArray(), nBins, fc.domain.toArray());
          }
          return found;
        }
      );
    return result;
  },
  /** Add the received featuresCountsResult to .featuresCountsResults,
   * either merging it with an existing result which overlaps the
   * domain and has the same binSize, or otherwise append.
   * @param fcResult
   */
  featuresCountsResultsMergeOrAppend(fcResult) {
    featuresCountsResultsTidy(fcResult);
    // based on featuresCountsResultsSearch()
    let 
    featuresCountsResults = this.get('featuresCountsResults'),
    combined = featuresCountsResults
      .find(
        (fcr) => {
          let found =
              // if the domains are equal, that is considered a match.
              (fcResult !== fcr) && (fcResult.binSize === fcr.binSize) && overlapInterval(fcResult.domain, fcr.domain);
          /* If the received result bridges the gap between two
           * existing results, then merge all three (later).
           */
          if (found) {
            /*if (trace_block > 1)*/ {
              dLog('featuresCountsResultsSearch', fcResult.domain.toArray(), fcResult.nBins, fcResult.binSize, fcr.domain.toArray());
            }
            /* Since these are counts within the same block, the
             * domain direction of the results will be the same. */
            if (featuresCountsResultsCheckOverlap(fcr, fcResult)) {
              /** if one of fcr or fcResult is a sub-interval then the
               * result is the other value, otherwise the result is in fcr.
               */
              let fcrM = featuresCountsResultsMerge(fcr, fcResult);
              if (fcrM === fcResult) { // probably ignore this condition, to get update for CP dependency.
                /** replace fcr with fcrM */
                featuresCountsResults.removeObject(fcr);
                featuresCountsResults.pushObject(fcrM);
                // to bridge a gap, use instead : featuresCountsResultsMergeOrAppend(fcrM)
              }
            }
          }
          return found;
        }
      );
    if (! combined) {
      featuresCountsResults.pushObject(fcResult);
    }
  },

});
