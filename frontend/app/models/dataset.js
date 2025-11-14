import { computed, set as Ember_set } from '@ember/object';
import { alias } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import { attr, hasMany, belongsTo } from '@ember-data/model';

import Record from './record';

//------------------------------------------------------------------------------

const dLog = console.debug;
const trace = 1;

//------------------------------------------------------------------------------

/** dataset[enableFeatureFiltersSymbol] true/false enables feature filters
 * in the genotype table for this dataset
 */
const enableFeatureFiltersSymbol = Symbol.for('enableFeatureFilters');

//------------------------------------------------------------------------------

export default Record.extend({
  apiServers : service(),
  blockService : service('data/block'),
  view : service('data/view'),
  dataGenotype : service('data/vcf-genotype'),


  name: attr('string'),

  parent : computed(
    'parentName',
    'apiServers.serversLength',
    'apiServers.datasetsBlocksRefresh',
    '_meta.referenceHost',
    function () {
      const fnName = 'parent';
      if (this.isDestroyed || this.isDestroying || this.isDeleted)
        return undefined;
      let parentName = this.get('parentName'),
      parent;
      if (parentName) {
        let
          apiServers = this.get('apiServers'),
        datasets = apiServers.dataset2stores(parentName);
        if (datasets.length === 0) {
          dLog(this.id, 'parent', parentName, 'no match');
        } else if (datasets.length === 1) {
          parent = datasets[0].dataset;
        } else {  // (datasets.length > 1)
          // normally this will be a remote and a local copy of that remote.
          if (datasets.length !== 2 || (datasets[0].isCopy === datasets[1].isCopy))
            dLog(this.id, 'parent', parentName, 'multiple match', datasets);
          /** If the user has indicated a preference via '_meta.referenceHost', use that.  */
          let referenceHost = this.get('_meta.referenceHost');
          if (referenceHost) {
            /** could use .includes() to treat referenceHost as a fixed string instead of a regexp. */
            let preferred = datasets.filter((d) => d.server.host.match(referenceHost));
            if (preferred.length) {
              dLog('parent', 'preferred count', preferred.length, preferred);
              parent = preferred[0].dataset;
            }
          }
          if (! parent) {
            /** prefer to use a dataset from its original source, rather than a copy
             * cached in primary server */
            let original = datasets.filter((d) => ! d.dataset.get('_meta._origin'));
            if (original.length) {
              if (original.length !== 1) {
                dLog(fnName, 'original count', original.length, original.mapBy('store.name'), original);
              }
              /** narrow to datasets which are original and primary */
              let op = original.filterBy('server', apiServers.primaryServer);
              dLog(fnName, 'original and primary', op.length, op.mapBy('store.name'), op);
              parent = op.length ? op[0].dataset : original[0].dataset;
            }
            else {
              /** perhaps at this point, prefer the host/server/store which this dataset is from. */
              let sameServer = datasets.filter((d) => d.store === this.store);
              if (sameServer.length) {
                dLog('parent', 'sameServer count', sameServer.length, sameServer);
                parent = sameServer[0].dataset;
              }
              else
                /* use the first in the list, this is probably the primary;
                 * user can be given control of this selection by setting _meta.referenceHost
                 */
                parent = datasets[0].dataset;
            }
          }
        }
        if (trace > 1)
          dLog(this.id, 'parent', parentName, parent);
      }
      return parent;
    }),

  parentName: attr(), // belongsTo('dataset', {inverse: 'children'}),
  // children: DS.hasMany('dataset', {inverse: 'parent'}),
  children : computed('parentName', function children () {
    let c = this.store.peekAll('dataset')
      .filterBy('parentName', this.get('id'));
    if (trace > 1) {
      dLog('children', c.length, this.id, (trace > 2) && c.mapBy('id'));
    }
    return c;
  }),

  groupId: belongsTo('group', { async: true, inverse : null }),
  blocks: hasMany('block', { async: false, inverse : null }),
  type: attr('string'),
  namespace: attr('string'),
  tags: attr('array'),
  _meta: attr(),

  /*--------------------------------------------------------------------------*/

  displayName : computed('_meta.displayName', function () {
    return this.get('_meta.displayName') || this.get('id');
  }),

  /** if isGerminate then _meta.germinate.mapDbId, otherwise .id,
   * This is used in request params, but not used e.g. in
   * sampleCache.sampleNames[], which is indexed by dataset.id
   */
  genotypeId : computed(function () {
    return this.get('_meta.germinate.mapDbId') || this.get('id');
  }),

  
  /** @return shortName if defined, otherwise name
   */
  shortNameOrName : computed('_meta.shortName', function () {
    return this.get('_meta.shortName') || this.get('id');
  }),

  /** @return a brief version of .createdAt */
  get createdAtShort() {
    return this.get('createdAt').toString().slice(0,21);
  },

  /*--------------------------------------------------------------------------*/


  /** is this dataset copied from a (secondary) server, cached on the server it was loaded from (normally the primary). */
  isCopy : computed('_meta._origin', function () {
    return !! this.get('_meta._origin');
  }),

  /** same as .blocks, with any blocks copied from a secondary server filtered out.
   */
  blocksOriginal : computed('blocks.[]', function () {
    let blocks = this.get('blocks')
      .filter((b) => ! b.get('isCopy'));
    return blocks;
  }),

  //----------------------------------------------------------------------------

  cropName : alias('_meta.Crop'),

  /** @return the array ._meta.Categories or [], concatenated with any
   * additional values matching ._meta.Category*
   */
  categories : computed( function categories () {
    const fnName = 'categories';
    let categories = this._meta?.Categories || [];
    const
    more = this._meta && Object.entries(this._meta)
      .filter(([key, value]) => key.match(/^Category/i))
      .map(([key, value]) => value);
    /** Handle and log data errors such as ._meta.Categories not being an array. */
    if (! Array.isArray(categories)) {
      console.log(fnName, categories);
      categories = typeof categories === 'string' ? [categories] : [];
    }
    if (more?.length) {
      categories = categories.slice().concat(more);
    }
    return categories;
  }),

  /*--------------------------------------------------------------------------*/

  /** @return true if this dataset has the given tag.
   */
  hasTag : function (tag) {
    let tags = this.get('tags'),
    has = tags && tags.length && (tags.indexOf(tag) >= 0);
    return has;
  },

  get isVCF() {
    return this.hasTag('VCF');
  },

  /** @return true if the samples of this dataset can be used in Genolink
   * Passport requests
   */
  get isGenolink() {
    return this._meta?.GenolinkURL;
  },

  //----------------------------------------------------------------------------

  /** positionFilter is applicable to VCF / genotype datasets, and indicates if
   * the genotype requests for the dataset should be filtered by position
   * intersection : i.e. whether Features/ SNPs are included in the result, by
   * the dataset having data at a position.

   * Values :
   *   undefined / null	no filter
   *   false	Feature / SNP is filtered out if dataset has a Feature at this position.
   *   true	Feature / SNP is filtered in if dataset has a Feature at this position.
   *   number 1 .. manageGenotype.gtDatasets.length - 1
   */

  /** Access the dataset positionFilter attribute as a field,
   * to factor the lookup, and to enable it to be used in dependencies.
   */
  get positionFilter() {
    return this[Symbol.for('positionFilter')];
  },
  set positionFilter(pf) {
    this[Symbol.for('positionFilter')] = pf;
    Ember_set(this, 'positionFilterText', this.positionFilterTextFn);
  },
  get positionFilterTextFn () {
    const
    pf = this.positionFilter,
    text = ['boolean', 'number'].includes(typeof pf) ? (pf ? '+' : '-') : '';
    return text;
  },
  // Could use a Computed Propery for positionFilterText - maybe when changing to Tracked Properties in Ember4.
  // positionFilterText : computed('positionFilter', function ),

  //----------------------------------------------------------------------------

  /** For a VCF dataset, sampleNames are received via bcftools request, and does
   * not change, so it is cached per dataset.
   * .sampleNamesSet is a Set() containing .sampleNames.
   */
  get sampleNames() {
    return this[Symbol.for('sampleNames')];
  },
  set sampleNames(names) {
    this[Symbol.for('sampleNames')] = names;
    this[Symbol.for('sampleNamesSet')] = new Set(names);
    return names;
  },
  get sampleNamesSet() {
    return this[Symbol.for('sampleNamesSet')];
  },

  //------------------------------------------------------------------------------

  /** samplesPassport : {
   * - genotypeID : { [sampleName] -> { field : name, ... } },
   * - accessionNumber : { [accessionNumber] -> { field : name, ... } }
   * - a2gMap : [accessionNumber] -> genotypeID. initial : new Map()
   * - g2aMap : [genotypeID] -> accessionNumber. initial : new Map()
   * }
   *
   * For a VCF dataset, sample Passport field Names are received via Genolink
   * getPassportData() request.  Fields may be added, but the passport data of a
   * sample does not change, so they are cached per dataset.
   */
  get samplesPassport() {
    const obj = this[Symbol.for('samplesPassport')];
    if (! obj) {
      /** Initial empty data structure. */
      this[Symbol.for('samplesPassport')] = {
        genotypeID : {}, accessionNumber : {},
        a2gMap : new Map(),
        g2aMap : new Map() };
    }
    return obj;
  },
  set samplesPassport(obj) {
    this[Symbol.for('samplesPassport')] = obj;
    return obj;
  },

  //------------------------------------------------------------------------------

  /** dataset[enableFeatureFiltersSymbol] true/false enables feature filters
   * in the genotype table for this dataset
   */
  get enableFeatureFilters() {
    let enabled = this[enableFeatureFiltersSymbol];
    if (enabled === undefined) {
      enabled = this[enableFeatureFiltersSymbol] = true;
    }
    return enabled;
  },
  set enableFeatureFilters(value) {
    this[enableFeatureFiltersSymbol] = value;
    // Count the change.  Used as dependency in selectedSampleEffect().
    const increment = value ? 1 : -1;
    this.dataGenotype.incrementProperty('datasetEnableFeatureFiltersCount', increment);
    return value;
  },

  /*--------------------------------------------------------------------------*/

  /** @return true if this dataset is owned by the logged-in user,
   * or has no group, or its group is visible to the logged-in user
   */
  get isVisible() {
    let visible = /*this.public ||*/ this.get('owner') || this.get('groupIsVisible');
    return visible;
  },
  /** @return true if this dataset has no group, or its group is visible to the
   * logged-in user
   */
  groupIsVisible : computed(
    'groupId.id',
    'server.groups.groupsInIds',
    'groupId.owner',
    function groupIsVisible() {
    let
    visible,
    groupId = this.get('groupId.id');
    if (! groupId) {
      visible = true;
    } else {
      let
      groups = this.get('server.groups'),
      /** if ! inGroup, then lookup of .groupId.* will cause 401. */
      inGroup = groups.inGroup(groupId),
      /** owner of group can see datasets in group, even if not a member. */
      ownGroup = this.get('groupId.owner');

      /** .groupId is likely a Proxy, with .content which may be null.
       * That case is handled by the above check on groupId.id.
       */
      visible = inGroup || ownGroup; //  && this.get('groupId.isVisible');
    }
    return visible;
    }),

  /*--------------------------------------------------------------------------*/

  isViewed : computed('blocks.[]', 'blockService.viewed.[]', function () {
    let viewed = this.get('blocks').any((b) => b.isViewed);
    return viewed;
  }),

  /*--------------------------------------------------------------------------*/

  blocksViewed : computed('blocks.@each.isViewed', function () {
    /**  depending on 'blockService.viewed.[]' may be more efficent. */
    let blocks = this.get('blocks').filter((b) => this.get('view').blockViewed(b));
    return blocks;
  }),
  blocksRecent : computed('blocksViewed.[]', function () {
    /** This repeats the filtering; could pass this.get('blocks'). */
    let blocks = this.get('view').blocksFilterSortViewed(this.get('blocksViewed'), true);
    return blocks;
  }),
  blocksFavourite : computed('blocksViewed.[]', function () {
    let blocks = this.get('view').blocksFilterSortViewed(this.get('blocksViewed'), false);
    return blocks;
  }),

  /*--------------------------------------------------------------------------*/

  /** Return a block of this dataset, choosing either the first viewed
   * block or the first block.
   * This is used by genotype-search / manage-genotype 
   * @return block
   */
  aBlock : computed( function () {
    const
    blocks = this.blocks,
    viewedBlocks = blocks.findBy('isViewed'),
    block = viewedBlocks || blocks[0];
    return block;
  }),

  //----------------------------------------------------------------------------

});
