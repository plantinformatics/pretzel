import { computed } from '@ember/object';
import { inject as service } from '@ember/service';
import Model, { attr, belongsTo, hasMany } from '@ember-data/model';
// import { computed, set } from '@ember/object';
import EmberObject from '@ember/object';
import { get as Ember_get, observer } from '@ember/object';
import { A } from '@ember/array';
import { and, alias } from '@ember/object/computed';
import { debounce, throttle } from '@ember/runloop';
import { pluralize } from 'ember-inflector';
import { allSettled } from 'rsvp';

import { task } from 'ember-concurrency';

import lodashMath from 'lodash/math';
import { isEqual } from 'lodash/lang';

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
  featuresCountsResultsDomain,
  featuresCountsResultsFilter,
  featuresCountsResultsTidy,
  featuresCountsDomain,
  featuresCountsResultSum,
  germinateCallsToCounts,
  featuresCountsTransform,
 } from '../utils/draw/featuresCountsResults';

import { fcsProperties } from '../utils/data-types';

import { stacks } from '../utils/stacks';

import { promiseText } from '../utils/ember-devel';

import BlockAxisView from '../utils/draw/block-axis-view';

/* global d3 */

/*----------------------------------------------------------------------------*/

const trace_block = 0;
const dLog = console.debug;

const moduleName = 'models/block';

/*----------------------------------------------------------------------------*/

/** trace the (array) value or just the length depending on trace level. */
function valueOrLength(value) { return (trace_block > 1) ? value : value.length; }

function numberOk(x) {
  return (typeof x === 'number') && ! isNaN(x);
}

/*----------------------------------------------------------------------------*/

const trace = 1;

export default Model.extend({
  pathsP : service('data/paths-progressive'), // for getBlockFeaturesInterval()
  blockService : service('data/block'),
  trait : service('data/trait'),
  dataView : service('data/view'),
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
  view : //undefined,
  /** the display of a block in an axis. */
  computed( function() {
    return new BlockAxisView(this);
  }),
  
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
    'featuresCountIncludingZoom', 'featureCount',
    function () {
    let
    dataset = this.get('datasetId'),
    paths = dataset.get('_meta.paths');
    // if no _meta.paths, then default to paths : true.
    /** if paths === false, this value is returned.  This is the usual case,
     * i.e. value in db is Boolean not string.
     * Allow paths===true to override the default value for dataset.tags
     */
    if (paths === undefined) {
      /* These cases can be allowed when zoomed in : this.isGenotype || this.isSNP.
       * For views the features are received from a remote server, so
       * the paths API endpoints are not applicable (client join may
       * be usable).  Germinate is a view.
       */
      paths = ! (this.hasTag('view') || this.hasTag('Germinate'));
    }
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
    const 
    /** Default to 5e4 in early high density data tests; increased for some chrs of 140e3 features. */
    featureCountForPaths = this.get('urlOptions.featureCountForPaths') || 200e3;

    /* don't request paths for HighDensity SNPs until zoomed in to small scale.
     * The comparison < featureCountForPaths will be false until .featureCount or
     * .featuresCountsResults are received, i.e. while
     * featuresCountIncludingZoom is undefined.
     *
     * 
     * Currently the high density data does not have symbolic names
     * (just chr:location) so paths via direct and aliases are not
     * applicable.  It is tagged HighDensity, but we should add a
     * separate tag to indicate the lack of a feature name.
     * So disable paths if tagged HighDensity.
     *
     * this expression uses the fact that (undefined < featureCountForPaths) is false.
     * .featureValueCount is approx 2 * .featureCount because it sums feature.value.length which is often 2.
     */
      paths &&= ! this.get('isHighDensity') && (
        (this.get('featureCount') < featureCountForPaths) ||
          (this.get('featureValueCount') < featureCountForPaths * 2) ||
          (this.get('featuresCountIncludingZoom') < featureCountForPaths));
      // dLog('showPaths', dataset, paths);
    return paths;
  }),

  /*--------------------------------------------------------------------------*/

  /** @return truthy if server has featuresCounts result for block
   * @desc
   * value is currently sum of counts for bins, i.e. total feature count of block.
   */
  get fcStatus() {
    const status = this[Symbol.for('featuresCountsStatus')];
    if (status) {
      dLog('fcStatus', status, this.brushName);
    }
    return status;
  },

  //----------------------------------------------------------------------------

  /** Enable this to monitor get/set of .featureCount
  featureCount_ : undefined,
  get featureCount() {
    return this.featureCount_;
  },
  set featureCount(count) {
    dLog('featureCount', count);
    this.featureCount_ = count;
  },
  */

  //----------------------------------------------------------------------------

  hasFeatures : computed('featureCount', 'featureValueCount', function () {
    /** featureValueCount > 0 implies featureCount > 0.
     * featureValueCount is from blockFeatureLimits, so it only updates after upload.
     * Could also use .featuresCountsResults - if any non-zero counts then block has features.
     * perhaps also .featureLimits
     */
    let count = this.get('featureCount') || this.get('featureValueCount');
    return count > 0;
  }),
  /** True if a block has features, or is a view and hence may have features.
   *
   * If features have been requested without a constraining domain interval and
   * 0 features were returned then .featureCount may be set to 0, indicating the
   * block definitely has no features, and in this case this fucntion returns
   * false.
   *
   * Role : to support dataBlocks definition, to enable requesting features.
   * related : isDataCount, isData
   */
  get mayHaveFeatures() {
    /* view blocks (e.g. VCF) have dynamic features - 0 in db, so initially ! hasFeatures. */
    /** (.featureCount === undefined) indicates count is not known, so this result may be true. */
    const mayHave = this.get('hasFeatures') || (this.hasTag('view') && (this.featureCount !== 0) );
    return mayHave;
  },
  get featureCountCurrent() {
    const
    isFiltered = this.controls.genotypeSNPFiltersDefined,
    count = isFiltered ? this.featureCountFiltered : this.featureCount;
    return count;
  },
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
  /** @return true if this block is a reference or a GM (i.e. it is it's own reference).
   * Each axis contains exactly 1 block for which .isReferenceForAxis is true.
   * @desc related @see referenceBlockOrSelf
   */
  isReferenceForAxis : computed('isData', 'datasetId.parentName', function isReference () {
    /** also : for a reference : this.get('range') !== undefined */
    let isReference = this.isData || ! this.get('datasetId.parentName');
    return isReference;
  }),
  currentDomain : computed('zoomedDomain', 'referenceBlockOrSelf.range', 'featuresDomain', function () {
    let domain = this.get('zoomedDomain');
    if (! domain)  {
      let referenceBlock = this.get('referenceBlockOrSelf');
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
    /** featuresLengthUpdate() is called from debounce()
     * so check if the component is still current. */
    if (! this.isDestroying && ! this.isDestroyed) {
      this.set('featuresLengthDebounced', featuresLength);
    }
  },
  featuresLengthUpdateThrottle() {
    let featuresLength = this.get('features.length');
    if (trace_block)
      dLog('featuresLengthUpdateThrottle', featuresLength, this.get('id'));
    /** featuresLengthUpdateThrottle() is called from throttle()
     * so check if the component is still current. */
    if (! this.isDestroying && ! this.isDestroyed) {
      this.set('featuresLengthThrottled', featuresLength);
    }
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
  isQTL : computed('datasetId.tags', 'datasetId._meta.type', function () {
    /* currently the QTL datasets created by uploadSpreadsheet.bash : qtlList()
     * have both tag QTL and meta.type : QTL */
    let isQTL =  this.hasTag('QTL') || this.get('datasetId._meta.type') === 'QTL';
    return isQTL;
  }),
  /** In the frontend VCF and Germinate are treated equally, so wherever isVCF
   * is currently used can be changed to isGenotype.
   * The tags define sets : view contains-subset Genotype contains-subset {VCF, Germinate},
   * so only hasTag('Genotype') is required here, once the new tag Genotype is
   * added to existing datasets.
   */
  isGenotype : computed('datasetId.tags', function () {
    let isGenotype = this.hasTag('Genotype') || this.hasTag('VCF') || this.hasTag('Germinate');
    return isGenotype;
  }),
  isVCF : alias('isGenotype'),
  /** Result indicates how axis-tracks display of features of this block should be coloured.
   * @return
   *  undefined for blockColour,
   *  !== undefined for featureColour, e.g. :
   * 'Ontology' for ontologyColour,
   * 'Trait' for traitColour.
   * 'Haplotype' for haplotypeColour.  (LD Block / tSNP)
   */
  get useFeatureColour() {
    let qtlColourBy = this.get('controls.viewed.qtlColourBy');
    let useColour;
    /** To disable haplotypeColour when 'Block' is selected :
     *   Move the VCF case to after the QTL case
     */
    if (this.get('isVCF')) {
      useColour = 'Haplotype';
    } else if (! qtlColourBy || (qtlColourBy === 'Block')) {
      useColour = undefined;
    } else if (this.get('isQTL')) {
      useColour = qtlColourBy;
    }
    return useColour;
  },
  isHighDensity : computed('datasetId.tags', function () {
    let isHighDensity = this.hasTag('HighDensity');
    return isHighDensity;
  }),
  isSyntenyBlock : computed('datasetId.tags', function () {
    let isSyntenyBlock = this.hasTag('SyntenyBlock');
    return isSyntenyBlock;
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

  /** status of cached histogram of features counts for this block.
   * This indicates that the histogram will be displayed immediately if the
   * block is viewed.
   * Value is currently the sum of the binned features counts, i.e. total
   * features count for the block.
   */
  get featuresCountsStatus() {
    return this[Symbol.for('featuresCountsStatus')];
  },
  set featuresCountsStatus(status) {
    this[Symbol.for('featuresCountsStatus')] = status;
  },

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
    if (this.hasTag('Germinate')) {
      /* limits of linkageGroup are not available, except via callsets calls -
       * done in germinateCallsToCounts().
       * this.set('featureLimits', [1, 700e6]);
       */

      /** approximate featureValueCount = markerCount / linkageGroupCount */
      const
      germinate = this.get('datasetId._meta.germinate'),
      blockCount = Ember_get(germinate, 'linkageGroupCount') ||
        this.get('datasetId.blocks.length'),
      markerCountPerChr = blockCount && Ember_get(germinate, 'markerCount') / blockCount;
      this.set('featureValueCount', markerCountPerChr || 0);

      return;
    }

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
        this.set('featureLimits', [+bfc.min, +bfc.max]);
        if (! this.get('featureValueCount'))
          this.set('featureValueCount', bfc.featureCount);
      }
    });

    return blockLimits;
  }).drop(),

  getLimits: function () {
    let blockId = this.get('id');
    dLog("block getLimits", blockId);
    if (this.hasTag('Germinate')) {
      return {_id : blockId, min : 1, max: 700e6};
    }

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
   * block.get('datasetNameAndScope') is related but uses shortName if
   * defined; previously (until 930e5491) brushHelper() used shortName,
   * but using datasetId.id ensures uniqueness, which is required since
   * selectedFeatures.Chromosome is for identifying the block (and
   * could be changed to blockId).
   *
   * brushHelper() now uses this function, i.e. it is the
   * source of the value .Chromosome in selectedFeatures.
   */
  brushName : computed('name', 'datasetId', function() {
    let
    brushName =
      /** this.name is often === this.scope  */
    this.get('datasetId.id') + ':' + this.get('name');

    return brushName;
  }),


  /*--------------------------------------------------------------------------*/

  /** server which this block was received from.
   *
   * It is possible that the block may be a copy from a secondary server which
   * is not currently connected.
   *
   * block id is generally unique across servers, but a reference block may
   * be copied from another server for use as test data, which would cause
   * id2Server[] to return the most-recently-connected server with that
   * block id, whereas servers[this.store.name] will handle that OK.
   * Otherwise these 2 expressions are equivalent.
   */
  server : computed( function () {
    /** no dependency needed because .server need only be calculated once.  */
    const
    apiServers = this.get('apiServers'),
    server = apiServers.servers[this.store.name] || 
      apiServers.id2ServerGet(this.id);
    return server;
  }),

  //----------------------------------------------------------------------------

  /** This will be different to referenceBlock if the parent has a parent.
   * I.e. referenceBlock corresponds to the axis, and parentBlock is the list of
   * features which this blocks feature.value.flankingMarkers[] refer to
   */
  parentBlock : computed('parentName', function () {
    let
    parent = this.get('datasetId.parent'),
    blocks = parent?.get('blocks'),
    pb = blocks && blocks.findBy('scope', this.scope);
    return pb;
  }),

  /** use .dataset : .parent.name or .parentName */
  datasetParentName : computed('datasetId.{parent.name,parentName}', function () {
    const
    d = this.get('datasetId'),
    p = d.get && d.get('parent');
    return p ? p.get('name') : d.get('parentName');
  }),

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
    /* If the parent has a parent, then use that name instead; referenceBlock
     * corresponds to the axis, i.e. the ultimate parent. */
    if (parent?.parentName) {
      if (trace_block) {
        dLog('referenceBlockSameServer', this.id, dataset.get('id'), parentName, parent.parentName);
      }
      parentName = parent.parentName;
      /* could instead change mapBlocksByReferenceAndScope() which currently
       * does not  blocks[0] = block  if block.parentName.  */
    }


    /** filter out self if parentName is defined, as in viewedReferenceBlocks() */
    let blockId = this.get('datasetId.parentName') && this.get('id');

    if (trace_block)
      dLog('referenceBlock', scope, dataset, reference, namespace, parent, parentName, parent && parent.get('id'));
    /* parent may be a promise, with content null. parent.get('id') or 'name'
     * tests if the dataset has a parent, whether dataset is an Ember store
     * object or a (resolved) promise of one.
     */
    if (parentName)
    {
      const server = this.get('server');

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
        /** Expect the referenceBlock to not have data, except for the parent of
         * a QTL, which may be a physical reference (no data), or a GM, which is
         * expected to have data.
         */
        let isQTL = this.get('isQTL');
        /** b.isData uses .referenceBlock, which may recurse to here, so use
         * direct attributes of block to indicate whether it is reference / data
         * block.
         * Also filter out self if this is a child block.
         * Accept block as a reference if it has a range or doesn't have features or a dataset parent name;
         * the possibility of references having parents has been floated, this does not support it.
         */
        referenceBlock = blocks && blocks.filter(
          (b) => b &&
            (isQTL ? true :
             (!!b.range || ! (b.featureValueCount || b.featureCount || b.featureLimits) ||
              ! b.get('datasetId.parentName'))) &&
            (! blockId || (b.get('id') !== blockId))
        );
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

  /** Choose the reference block which will be used by default.
   * Choose, in this order :
   * . a viewed reference block
   * . a reference block on the same server as this
   * . .referenceBlocks[0] if there is only 1, otherwise the user can select from .referenceBlocks
   *   in {{panel/select-parent block=blockWithoutParentOnPrimary }}
   *
   * Used in manage-explorer.js : loadBlock()
   * This overlaps with the choice of referenceBlock in viewRelatedBlocks() in
   * services/data/view.js
   */
  chooseReferenceBlock() {
    let referenceBlocks;
    const
    referenceBlock = this.viewedReferenceBlock() || 
      this.referenceBlockSameServer() || 
      ((referenceBlocks = this.referenceBlocks) && (referenceBlocks.length === 1) && referenceBlocks[0]);
    return referenceBlock;
  },

  /** Collate the viewed reference blocks which match the .scope
   * and .datasetId or .parentName of this block.
   * This function may be called when !this.isViewed - see referenceBlock().
   * @param matchParentName true means match this.datasetId.parentName, otherwise match this.datasetId.id
   * @return reference blocks, or []
   */
  viewedReferenceBlocks(matchParentName) {
    const fnName = 'viewedReferenceBlocks';
    let referenceBlocks = [],
    datasetName = matchParentName ?
      this.get('datasetId.parentName') :
      this.get('datasetId.id'),
    scope = this.get('scope'),
    /** filter out self if parentName is defined */
    blockId = this.get('datasetId.parentName') && this.get('id');
    /** Handle blocks whose dataset.parent has a .parent */
    let parent = this.get('datasetId.parent');
    if (parent && parent.parentName) {
      if (! matchParentName)
      dLog('viewedReferenceBlocks', blockId, datasetName, parent.parentName);
      datasetName = parent.parentName;
    }

    if (datasetName) {
      let mapByDataset = this.get('blockService.viewedBlocksByReferenceAndScope');
      if (mapByDataset) {
        let mapByScope = mapByDataset.get(datasetName);
        if (! mapByScope) {
          if (matchParentName && (this.isViewed || trace_block > 1)) {
            dLog(fnName, 'no viewed parent', datasetName, scope, mapByDataset);
          }
        } else {
          let blocks = mapByScope.get(scope);
          if (! blocks) {
            if (matchParentName && (this.isViewed || trace_block > 1)) {
              dLog(fnName, 'no matching scope on parent', datasetName, scope, mapByScope);
            }
          } else {
            blocks.forEach((block, i) => {
              if ((block === undefined) && (i === 0)) {
                dLog(fnName, 'reference not viewed', datasetName, scope);
              } else if ((block === undefined)) {
                dLog(fnName, 'block undefined', datasetName, scope);
              } else if (scope !== block.get('scope')) {
                dLog(fnName, 'not grouped by scope', block.get('id'), scope, block._internalModel.__data, datasetName);
              }
              /* viewedBlocksByReferenceAndScope() does not filter out
               * blocks[0], the reference block, even if it is not viewed, so
               * filter it out here if it is not viewed.
               * Also filter out self if this is a child block.
               */
              else if (
                block.get('isViewed') &&
                  (! block.get('datasetId.parent')) &&
                  (! blockId || (block.get('id') !== blockId))) {
                referenceBlocks.push(block);
              }
            });
          }
        }
        if (trace_block > 1)
          dLog(fnName, referenceBlocks, datasetName, scope);
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
    /** filter out self if parentName is defined, as in viewedReferenceBlocks() */
    blockId = parentName && this.get('id'),
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
           * Also filter out self if this is a child block.
           */
          if ((block.get('scope') === scope) &&
              (! blockId || (block.get('id') !== blockId)))
            result.push(block);
        });
        return result;
      }, []);
    dLog('referenceBlocksAllServers', original, parentName, scope, blocks);
    return blocks;
  },
  /** If this block has a parent which has a parent, return them in an array, otherwise undefined.
   */
  parentAndGP() {
    /** Use this function when this.referenceBlock is undefined.  */
    let referenceBlocks = this.referenceBlocksAllServers(false);
    let parents;
    if (referenceBlocks.length) {
      let parent = referenceBlocks.find((b) => b.referenceBlock);
      parents = parent && [parent, parent.referenceBlock];
      dLog('parentAndGP', (parents ? [this, ...parents] : [this]).mapBy('datasetId.id'));
    }
    return parents || [];
  },
  childBlocks : computed('blockService.blocksByReference', function () {
    let blocksByReference = this.get('blockService.blocksByReference'),
    childBlocks = blocksByReference && blocksByReference.get(this);
    return childBlocks || [];
  }),
  /** @return child blocks of this block which are viewed.
   * [] if none.  If this block is not a reference then it has no child blocks.
   * @desc
   * Related : axis-1d:viewedBlocks(), which can be used to verify - should be equivalent.
   */
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
    let viewedFor = this.get('dataView').unviewFor(this);
    if (viewedFor) {
      dLog('unViewChildBlocks', this.id, viewedFor.id);
      this.get('blockService').setViewed(viewedFor, false);
    }
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

  //----------------------------------------------------------------------------

  /** If .isVCF filter .featuresCountsResults by SNP filters defined by user in
   * genotype table controls.
   *
   * Added after 339ab17b, this provides a view of .featuresCountsResults which
   * is narrowed to match the current user controls, and is substituted for
   * .featuresCountsResults in all the downstream functions which read
   * featuresCountsResults :
   *  featuresCountIncluding{Brush,Zoom}
   *  featuresCounts{InBrush,InZoom,OverlappingInterval,ResultsSearch,ResultsMergeOrAppend} .
   * featuresCountsResultsMergeOrAppend() writes to the source value : .featuresCountsResults
   */
  featuresCountsResultsFiltered : computed('featuresCountsResults.[]', 'controls.genotypeSNPFilters', function () {
    const fnName = 'featuresCountsResultsFiltered';
    let fcrs = this.featuresCountsResults;
    /* germinateCallsToCounts() does not currently set .userOptions in
     * featuresCountsResults. */
    if (this.isVCF && ! this.hasTag('Germinate')) {
      /** Currently only genotype SNP Filters are used; the field name
       * userOptions is generic because featuresCountsResults of other
       * dataset types may have other, different, filters.
       */
      const userOptions = this.controls.genotypeSNPFilters;
      const unfilteredLength = fcrs.length;
      /* No filtering is done if .genotypeSNPFilters is empty or fcr.userOptions
       * is not defined.  Could use : genotypeSNPFiltersDefined()
       */
      if (Object.keys(userOptions).length) {
        fcrs = fcrs.filter(fcr => ! fcr.userOptions || isEqual(userOptions, fcr.userOptions));
        dLog(fnName, fcrs.length, unfilteredLength);
      }
    }
    return fcrs;
  }),

  //----------------------------------------------------------------------------

  /** if .featureCount is defined, calculate the approximate proportion within
   * zoom or brush if defined, otherwise return all.
   */
  featureCountProrata(count) {
      const
      limits = this.get('limits'),
      subDomain = this.brushedDomain || this.zoomedDomain;
      if (limits && subDomain) {
        const
        subDomainSize = intervalSize(subDomain),
        domainSize = intervalSize(limits);
        if (numberOk(subDomainSize) && numberOk(domainSize) && domainSize) {
          count = count * subDomainSize / domainSize;
        }
      }
      return count;
  },

  /** If the axis of this block is brushed, return .featureCountInBrush if
   * .featuresCountsResultsFiltered.length otherwise featureCountProrata(.featureCountCurrent).
   * If not brushed, return .featureCountCurrent
   */
  featuresCountIncludingBrush : computed(
    'featuresCountsResultsFiltered.[]',
    'featureCountInBrush', 'brushedDomain.{0,1}' /* -Debounced */, 'limits',
    function () {
      let
      count = this.get('axis1d.brushed') ?
        (this.featuresCountsResultsFiltered.length ?
         this.get('featureCountInBrush') :
         this.featureCountProrata(this.featureCountCurrent) ) :
        this.featureCountCurrent;
      if (trace_block > 1)
        dLog('featuresCountIncludingBrush', count);
      return count;
    }),

  /** @return the features count within zoomedDomain, or if there is no zoom,
   * i.e. zoomedDomain is undefined, then simply return .featureCountCurrent
   */
  featuresCountIncludingZoom : computed(
    'featuresCountsResultsFiltered.[]',
    'featureCountInZoom',
    '{zoomedDomainDebounced,zoomedDomainThrottled}.{0,1}',
    'limits',
    function () {
      let
      count = this.get('axis1d.zoomed') ?
        (this.featuresCountsResultsFiltered.length ? this.get('featureCountInZoom') : undefined ) :
        this.featureCountCurrent;
      if (trace_block > 1)
        dLog('featuresCountIncludingZoom', count);
      return count;
    }),

  /** Same as featuresCountsInZoom(), but for the brushedDomain instead of the zoomedDomain
   */
  featuresCountsInBrush : computed(
    'featuresCountsResultsFiltered.[]', 'brushedDomain.{0,1}' /* -Debounced */, 'limits',
    function () {
      let
      domain = this.get('brushedDomain'),
      overlaps;
      if (! domain) {
        overlaps = this.get('featuresCountsResultsFiltered');
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
   * If not zoomed (no zoomedDomain), return featuresCountsResultsFiltered.
   * @return undefined if no results or no overlaps
   * Result form is the same as featuresCountsResultsFiltered, i.e.
   * [ {binSize, nBins, domain: Array(2), result: Array}, ... ]
   */
  featuresCountsInZoom : computed(
    'featuresCountsResultsFiltered.[]',
    '{zoomedDomainDebounced,zoomedDomainThrottled}.{0,1}',
    'limits',
    function () {
      let
      domain = this.get('zoomedDomain'),
      limits = this.get('limits'),
     overlaps;
      if (! this.get('axis1d.zoomed') || ! domain) {
       overlaps = this.get('featuresCountsResultsFiltered');
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
    const fnName = 'featureCountInInterval';
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
      dLog(fnName, intervalName, overlaps, domain, coverage, smallestOver1I, largestUnder1I, selectedOverlapI, selectedOverlap, count);
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
    let
    properties = fcsProperties(fcs),
    count = fcs.result.reduce( (sum, fc, i) => {
      /** an interval parameter is passed to getBlockFeaturesCounts(), so result
       * type of the request is featureCountDataProperties.
       */
      let
      binInterval = properties.datum2Location(fc),
      /** count within bin */
      binCount = properties.datum2Value(fc);
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
   * interval is not undefined;  if !interval, this function is not called.
   */
  featuresCountsOverlappingInterval(interval) {
    let
    fcLevels = this.get('urlOptions.fcLevels'),
    overlapFn = fcLevels ? overlapInterval : this.almostSubInterval,
    featuresCounts = this.get('featuresCountsResultsFiltered') || [],
    overlaps = featuresCounts.reduce(
      (result, fcs) => {
        if (fcs.domain && overlapFn(interval, fcs.domain)) {
          let
          properties = fcsProperties(fcs),
          filtered = Object.assign({}, fcs);
          filtered.result = fcs.result.filter(
            (fc) => {
              /** empty result is : _id: { min: null, max: null } (no idWidth[]).  */
              let emptyResult = (fc._id.min === null) && (fc._id.max === null);
              let ok = ! emptyResult;
              if (ok) {
                let loc = properties.datum2Location(fc);
                ok = overlapInterval(loc, interval);
              }
              return ok;
            }),
          result.push(filtered);
        }
        return result;
      }, []);
    if (trace_block > 1)
      dLog('featuresCountsOverlappingInterval', featuresCounts, overlaps);
    return overlaps;
  },

  // ---------------------------------------------------------------------------

  /** @return features of this block, filtered by brushedDomain if the axis of
   * this block is brushed.
   */
  featuresInBrushOrZoom : computed('brushedDomain.{0,1}', 'zoomedDomain.{0,1}', 'features.[]', function() {
    /** zoomedDomain is replaced when it changes, so dependency .{0,1} is not required. */
    let
    features,
    /** .zoomedDomain is always defined */
    interval = this.brushedDomain || (this.axis1d.zoomed && this.zoomedDomain);
    if (interval) {
      const
      // based on similar in featureInRange().
      valueInInterval = this.controls.get('view.valueInInterval');
      /** filter by axisBrush .brushedDomain */
      features = this.features.filter((f) => valueInInterval(f.value, interval));
    } else {
      features = this.features.toArray();
    }
    return features;
  }),

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
      /* also check for .id match, block object references may not match because
       * axisBrush.block is in the wrong store;
       * solution is to move model/axis-brush out of store, in a separate commit.
       */
      axis1d = axisBlocks.find((ab) => (ab[1] === this) || (ab[1].get('id') === this.get('id')));
      axis1d = axis1d && axis1d[0];
      return axis1d;
    }),

  /** match with a different server, using reference dataset name and scope. */
  get crossServerAxis1d() {
    let
    scope = this.get('scope'),
    datasetId = this.get('datasetId.id'),
    axes1d = this.get('blockService').axes1d,
    axis1d = axes1d.datasetIdScope2axis1d(datasetId, scope);
    return axis1d;
  },
  axis1d : computed(
    'referencedAxis1d', 'referenceBlock.referencedAxis1d',
    function () {
      const fnName = 'axis1d';
      let axis1d = this.get('referencedAxis1d') || this.get('referenceBlock.referencedAxis1d');
      if (! axis1d) {
        axis1d = this.get('crossServerAxis1d') || this.get('referenceBlock.crossServerAxis1d');
        dLog(fnName, axis1d, this);
      }

      if (axis1d?.isDestroying) {
        dLog('axis1d isDestroying', axis1d);
        axis1d = undefined;
      }
      let a1Check = this.verify_axis1d();
      if (axis1d !== a1Check) {
        dLog('axis1d', axis1d, a1Check);
      }
      if (! axis1d) {
        // this.axis is now aliased to this function
        dLog(fnName, axis1d, this.id, this.get('referenceBlock.id'), /*this.axis,*/ a1Check);
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
      axes1d = this.get('blockService.axes1d').get('axis1dArray');
      axis1d = axes1d.find(
        (a1) => !a1.isDestroying &&
          ((a1.get('axis') === this) || 
           (a1.viewedBlocks.find((b) => b === this))));
      if (trace_block > 1) {
        dLog('axis1d', axis1d, axes1d, this.id, this.get('axis.axis1d'));
      }
    }
    return axis1d;
  },

  axis : alias('axis1d'),
  axis_orig : computed(/*'view.axis'*/'isViewed', 'referenceBlock', function () {
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

  axisName : alias('referenceBlockOrSelf.id'),

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
    'featuresCountsResultsFiltered.[]',
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
        ! (this.featureCountCurrent <= this.get('featuresCountsThreshold'));
    dLog('isZoomedRightOut', out, this.featureCountCurrent, this.get('featuresCountsThreshold'));
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

  //----------------------------------------------------------------------------

  /** Block Colour
   * Currently based on colours allocated to data blocks in axis title menu and
   * used to colour axis tracks, later this will map to "Dataset Colour",
   * i.e. all axes will use a common colour for data blocks of a single dataset.
   * @return rgb() colour string
   */
  get colourValue() {
    const
    axis1d = this.get('axis1d'),
    blockColourValue = axis1d.blockColourValue(this);
    return blockColourValue;
  },

  /*--------------------------------------------------------------------------*/

  /** @return current .zoomedDomain, or .limits
   * @desc related : currentDomain()
   */
  getDomain() {
    let
    /** if ! .axis1d.zoomed then zoomedDomain is .limits  */
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

  //----------------------------------------------------------------------------

  positionFilter : alias('datasetId.positionFilter'),

  /** Record the positions at which this block has features.

   * This is used for VCF view blocks, whose features have a single-base position.
   * The Features are created in frontend (only) from API results.
   *
   * This is used to implement genotype table dataset (block) intersections,
   * which doesn't require a mapping from position to feature - a Set is sufficient,
   * but featurePositions could be a map to feature, or a sparse array[position] -> feature,
   * or an interval tree, or a single-position tree.
   */
  addFeaturePositions(createdFeatures) {
    const
    fnName = 'addFeaturePositions',
    featurePositions = this[Symbol.for('featurePositions')] || (
      this[Symbol.for('featurePositions')] = new Set()
    );

    createdFeatures.forEach(feature => {
      featurePositions.add(feature.get('value.0'));
    });
  },

  /*--------------------------------------------------------------------------*/

  /** @return Set() of trait names of Features of this block.
   * undefined if block is not a QTL, and hence is not expected to have
   * features[*].values.Trait.
   */
  traitSet : computed('features.[]', function () {
    let traitSet;
    if (this.get('isQTL')) {
      traitSet = 
        this.get('features')
        .reduce((ts, feature) => {
          let name = feature.get('values.Trait');
          if (name) { ts.add(name); }
          return ts;
        }, new Set());
    }
    return traitSet;
  }),
  /** @return undefined or array of trait names from this.traitSet */
  traits : computed('traitSet', function () {
    let
    traitSet = this.get('traitSet'),
    traits = traitSet && Array.from(traitSet.values());
    dLog('traits', traits, this.id);
    return traits;
  }),


  /** If this block contains QTLs, request all features of this block and the referencedFeatures of its parent block.
   * This enables calculation of the .value[] of the QTL features.
   */
  loadRequiredData : computed(function () {
    const fnName = 'loadRequiredData';
    /* No dependency - will compute once.  */
    // possibly generalise the tag from 'QTL' to : 'valueComputed'
    if (this.get('isQTL')) {
      let
      /** make the 2 requests in serial because of .drop() on getBlockFeaturesIntervalTask()
       */
      features = this.get('allFeatures')
        .then((f) => {
          // dLog(fnName, 'allFeatures', this.name, this.id, f?.length);
          if (! f) {
            dLog('loadRequiredData', this.id, this.get('datasetId.id'),
                 this.get('datasetId.parent.id'), this.get('parentBlock.datasetId.id'));
          } else {
            f.forEach((fi) => fi?.value?.forEach((fii) => this.get('trait').traitAddQtl(fii)));
          }
          /** If there are values in f other than [0] then could use f.mapBy('value').flat() */
          const features = f[0].value;
          return [f, this.referencedFeaturesOf(features)];})
      // parentBlockFeatures = ;
      // parentBlockFeatures // allSettled([features, parentBlockFeatures])
        .then((ps) => {
          let parentFeatures = ps[1];
          // dLog(fnName, 'parentFeatures', this.name, this.id, ps, parentFeatures);
          return parentFeatures && parentFeatures.then((pf) => {
            // dLog(fnName, 'features', this.name, this.id, pf, ps[0][0].value);
            /** referencedFeatures() yields an array of Features : pf */
            let features = ps[0][0].value,
                /** no return value, so result is a promise yielding undefined */
                f2 = this.valueCompute(features, pf);
            this.collateQTLs('Trait');
            this.collateQTLs('Ontology');
            return f2;
          });
        });
    }
  }),
  /** After valueCompute(), which will put positions of .values.flankingMarkers
   * in .value[], collate the Traits and Ontology-s of QTL features of this
   * block which have .value.length.
   * This is a subset of the API result blockFeature{Traits,Ontologies}
   * (components/service/api-server.js) because that collates all QTLs,
   * regardless of whether they have .value.length.
   *
   * Result is an Ember array of unique names, stored in .positioned.<fieldName>
   *
   * @param fieldName 'Trait' or 'Ontology'
   */
  collateQTLs(fieldName) {
    let
    names = this.get('features')
      .reduce((result, feature) => {
        let name = feature.get('values.' + fieldName);
        /** filter out QTL features which do not have a default [start,end] or
         * a position computed from FMs */
        if (name && feature.get('value.length')) {
          result.addObject(name);
        }
        return result; }, A());
    if (names.length) {
      dLog('collateQTLs', fieldName, names, this.id, this.get('datasetId.id'));
    }
    if (! this.get('positioned')) {
      this.set('positioned', {});
    }
    let previous = this.get('positioned.' + fieldName);
    let compare = previous;
    if (! previous) {
      let fieldNames = pluralize(fieldName);
      compare = this.attributes && this.attributes[fieldNames];
    }
    /** don't increment featureUpdateCount if the names has not changed. */
    let newOrChanged = true;
    if (compare) {
      let
      compareS = compare.sort(),
      namesS = names.sort();
      newOrChanged = ! isEqual(compareS, namesS);
    }
    if (newOrChanged) {
      this.set('positioned.' + fieldName, names);
      /** Generally there will be an initial reduction from
       * .attributes[fieldNames] to .positioned[fieldName] as un-positioned QTLs
       * are filtered out.
       * Incrementing featureUpdateCount in that case is debatable because it
       * causes refresh of explorer Ontology tree; a solution would be an API
       * which did valueCompute(), checkPositions() etc.
       * After that .positioned[fieldName] will only change when flankingMarkers
       * are edited (via re-upload), or the parent GM is edited, in which case
       * incrementing featureUpdateCount is reasonable.
       */
      if (previous) {
      // re-evaluate blockValuesBlocks() / checkPositions()
        this.get('blockService').incrementProperty('featureUpdateCount');
      }
    }
  },
  /** Request all features of this block.
   * @return promise yielding features
   */
  allFeatures : computed(function () {
    /* No dependency - will compute once, and thereafter return cached value.  */
    let
    pathsPro = this.get('pathsP'),
    featuresP = pathsPro.getBlockFeaturesInterval(this.id, /*all*/true);
    return featuresP;
  }),

  /** Request features for blockId, within the interval which
   * requestBlockFeaturesInterval() derives from axisDimensions(blockId).
   *
   * Moved here from services/data/paths-progressive.js, to enable a request per block, in parallel.
   */
  getBlockFeaturesIntervalTask : task(function* (blockId, all) {
    let
      fnName = 'getBlockFeaturesIntervalTask',
      features = yield this.get('pathsP').requestBlockFeaturesInterval(blockId, all);
      if (trace_block)
        dLog(fnName, blockId, all, promiseText(features));
    return features;
    /* tried .enqueue().maxConcurrency(3), but got 2 identical requests, so .drop() instead;
     * Perhaps later: split requestBlockFeaturesInterval() into parameter gathering and request;
     * the latter function becomes the task; store last request params with the corresponding task;
     * check request params against last and if match then return that task perform result.
     */
  }).drop(),


  /** Request all features of the parent of this block which are referred to by
   * this block, via .values.flankingMarkers [].
   * @return a Promise yielding an array of Features
   */
  referencedFeatures : computed('parentBlock', function () {
    const fnName = 'referencedFeatures'; // + ' (loadRequiredData)';
    this.referencedFeaturesOf(this.get('features'));
  }),
  /** Same comment as @see referencedFeatures()
   * @param features of this block, from loadRequiredData() via allFeatures()
   * @return promise yielding features of .parentBlock which are referenced by features[].
   */
  referencedFeaturesOf(features) {
    const fnName = 'referencedFeaturesOf'; // + ' (loadRequiredData)';
    let
    featureNames = features
      .filterBy('values.flankingMarkers')
      .mapBy('values.flankingMarkers')
      .flat();

    /** Send the request to the server of .parentBlock.
     * The featureNames are not server-specific, unlike blockId.
     * Comment on similar lookup .servers[ .store.name] in referenceBlockSameServer()
     */
    let parentBlock = this.get('parentBlock');
    let blockTask;
    // dLog(fnName, this.name, this.id, this.get('features.length'), featureNames.length,  parentBlock?.id);
    if (featureNames.length && parentBlock) {
      let apiServer = this.get('apiServers').servers[parentBlock.store.name];

      let taskGet = this.get('blockService').get('getBlocksOfFeatures');

      /** referencedFeatures() is used by loadRequiredData() for valueCompute()
       * for determining QTL position from QTL .values.flankingMarkers;
       * Currently using direct feature search for this, but feature search by aliases is on the roadmap.
       */
      blockTask = taskGet.perform(apiServer, /*matchAliases*/false, parentBlock.id, featureNames);
      blockTask
        .then((features) => {
          dLog(fnName, 'referencedFeatures', featureNames[0], featureNames.length, features.length);
        });
    }
    return blockTask;
  },



  /** Calculate the value / location of the 
   * @param features of this block
   * @param parentFeatures features of the parent / reference block
   */
  valueCompute(features, parentFeatures) {
    const fnName = 'valueCompute';
    dLog(fnName, features?.length, parentFeatures?.length);
    if (features?.length && parentFeatures?.length) {
      let
      featuresExtents =
        features.map((f) => {
          let value;
          /** currently the spreadsheet may define value start&end, could verify by checking this against calculated value. */
          let f_value = f.get('value')
              .filter((v) => (v !== undefined) && (v !== null));
          /** Flanking Markers take precedence, if defined in parentFeatures and
           * they have non-empty .value[] */
          if (true) /*(f.value[0] === null)*/ {
            let
            flankingNames = f.get('values.flankingMarkers') || [],
            flanking = flankingNames.map((fmName) => {
              let fm = parentFeatures.findBy('name', fmName);
              if (! fm) {
                dLog(fnName, fmName, parentFeatures);
              }
              return fm;
            }).filter((f) => f);
            if (flanking.length) {
              let
              locations = flanking.map((fm) => fm.value).flat(),
              extent = d3.extent(locations);
              if (locations.length) {
                f.set('value', extent);
              }
              value = extent;
            } else {
              value = f_value;
            }
          } else {
            value = f_value;
          }
          if (! value.length && trace_block > 1) {
            /* this is likely a data error - either no f.values.flankingMarkers,
             * or the FMs are not in parentFeatures[]. */
            dLog(fnName, 'no value', f.value, f.values?.flankingMarkers);
          }
          return value;
        });
      let blockExtent = d3.extent(featuresExtents.flat());
      dLog(fnName, this.id, this.name, blockExtent, featuresExtents);
      this.set('featureLimits', blockExtent);
    }
  },

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
    // featuresCountsResultsSearch() uses .featuresCountsResultsFiltered
    'featuresCountsResultsFiltered.[]',
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
    const
    fnName = 'featuresForAxis',
    blockId = this.get('id'),
    isGerminate = this.hasTag('Germinate'),
    /** Count of loaded features in the current view.
     * If count is not defined and this.hasTag('view') then get featuresCounts
     * first, except for hasTag('Germinate') which does not yet support
     * featuresCounts so use getFeatures().
     * featuresCountIncludingZoom is not updated if featuresCountsResultsFiltered is [].
     */
    count = (this.get('featuresCountsResultsFiltered.length') && this.get('featuresCountIncludingZoom')) ||
        (isGerminate && this.featureCountProrata(this.get('features.length')??0)),
    isZoomedOut = this.get('isZoomedOut'),
    featuresCountsThreshold = this.get('featuresCountsThreshold');
    let features;
    dLog('featuresForAxis', isZoomedOut, count, featuresCountsThreshold, this.get('zoomedDomain'), this.get('zoomedDomainDebounced'));

    /** if the block has chartable data, get features regardless; may also request featuresCounts.
     * Similarly for Germinate, start by getting all features (just 1 sample),
     * to provide a zoomed-out view (can construct a histogram from this result).
     */
    const
    all = isGerminate &&
      ! this.loadingAllFeatures &&
      (this.loadingAllFeatures = true);
    /** can use isZoomedOut here instead, e.g. (isZoomedOut === true)  */
    if (all || this.get('isChartable') ||
        ((count !== false) && (count !== undefined) && (count <= featuresCountsThreshold))) {
      const featuresP = this.getFeatures(blockId, all);
      if (all) {
        featuresP.then(promiseResult => {
          /** expect :
              (promiseResult.length === 1) &&
              ((features[0].state === 'fulfilled') ||
              features[0].hasOwnProperty('value'))
          */
          dLog(fnName, promiseResult.length, promiseResult[0]?.state);
          let features;
          if ((promiseResult[0]?.state !== 'fulfilled') ||
              ! (features = promiseResult[0].value)) {
            dLog(fnName, blockId, 'getFeatures', promiseResult, promiseResult?.[0]);
          } else {
            const
            summary = germinateCallsToCounts(features),
            counts = summary.counts;
            featuresCountsTransform(this, counts);
            if (summary.limits && ! this.featureLimits) {
              this.featureLimits = summary.limits;
            }
          }
        });
      }
    }
    const
      domain = this.getDomain();
    if (! domain) {
      dLog(fnName, 'no domain yet', this.zoomedDomain, this.limits);
    } else
    /** if featuresCounts not yet requested then count is undefined
     * Equivalent to check if .featuresCountsResultsFiltered.length === 0.
     */
    if ((this.featuresCounts === undefined) || ((count === false) || (count === undefined) || (count > featuresCountsThreshold))) {
      let
      minSize = this.get('featuresCountsInZoomSmallestBinSize'),
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
      let fcDomain, coverage;
      /** Conditions for requesting featuresCounts via getBlocksSummary() :
       * _ minSize === 0 indicates no featuresCounts overlapping this zoomedDomain.
       * _ or if .featuresCounts does not cover .axis1d.domain well (70%).
       *    or axis is zoomed out
       */
      if (((minSizePx === 0) || (minSizePx > threshold))  /* px */ ||
          ((fcDomain = featuresCountsDomain(this.featuresCounts)) &&
           (((coverage = intervalOverlapCoverage(fcDomain, this.axis1d.domain)) < 0.7) ||
            ! this.axis1d.zoomed
           )) ) {

        if (fcDomain && coverage) {
          dLog(fnName, 'coverage', coverage, fcDomain, this.axis1d.domain, this.axis1d.zoomed);
        }

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
  /**
   * @param all true means request all features of the block
   * @return promise yielding received features
   */
  getFeatures(blockId, all) {
    const fnName = 'getFeatures';
    let
    features = this.get('pathsP').getBlockFeaturesInterval(blockId, all);

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
    result = this.get('featuresCountsResultsFiltered')
    // based on similar block-view.js:selectFeaturesCountsResults(): betterResults
      .find(
        (fc) => {
          let found =
              // if the domains are equal, that is considered a match.
              (lengthRounded === fc.binSize) && fc.domain && subInterval(domain, fc.domain);
          if (found) {
            if (trace_block > 1)
              dLog('featuresCountsResultsSearch', domain.toArray(), nBins, fc.domain.toArray());
          }
          return found;
        }
      );
    return result;
  },
  // Use fcResult to set .featureCount or .featureCountFiltered
  featureCountFromResult(fcResult) {
    const fnName = 'featureCountFromResult';
    if (this.hasTag('view') && isEqual(this.limits, fcResult.domain)) {
      const
      blockSum = featuresCountsResultSum(fcResult.result),
      isFiltered = Object.values(fcResult.userOptions).find(v => (v !== undefined) && (v !== '')),
      fieldName = 'featureCount' + (isFiltered ? 'Filtered' : '');
      if (isFiltered || ! this.featureCount) {
        dLog(fnName, this.id, fieldName, blockSum);
        this.set(fieldName, blockSum);
      }
    }
  },
  /** Add the received featuresCountsResult to .featuresCountsResults,
   * either merging it with an existing result which overlaps the
   * domain and has the same binSize, or otherwise append.
   * @param fcResult
   */
  featuresCountsResultsMergeOrAppend(fcResult) {
    featuresCountsResultsTidy(fcResult);

    this.featureCountFromResult(fcResult);

    // based on featuresCountsResultsSearch()
    let 
    /** Search in .featuresCountsResultsFiltered, i.e. .userOptions
     * should match if defined, and update .featuresCountsResults
     * Since it is possible for .controls.genotypeSNPFilters to change between
     * request and response, could factor a function
     * featuresCountsResultsFiltered(userOptions) out of
     * .featuresCountsResultsFiltered, and use it here with param
     * (fcResult.userOptions), i.e. it would filter .featuresCountsResults to
     * match fcResult.userOptions.
     */
    featuresCountsResults = this.get('featuresCountsResults'),
    combined = this.featuresCountsResultsFiltered
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
      /** fcResult.domain is set by featuresCountsResultsFilter(), called from featuresCountsResultsMerge().
       * In this (non-merge) case, use featuresCountsResultsDomain() to set .domain.
       */
      featuresCountsResultsDomain(fcResult);
      featuresCountsResults.pushObject(fcResult);
    }
  },

  // ---------------------------------------------------------------------------
  /** transient state */

  /** indicate which fields will be displayed in the axis title, if this block
   * is the reference block of an axis.
   *  name : if true then .datasetId.shortNameOrName (e.g. ._meta.shortName)
   *  scope : if true then .scope
   *
   * also @see datasetNameAndScope()
   */
  axisTitleShow : EmberObject.create({name : true, scope : true}),
 
  // ---------------------------------------------------------------------------



});
