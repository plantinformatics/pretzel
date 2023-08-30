import { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import Component from '@ember/component';
import { inject as service } from '@ember/service';
import { task } from 'ember-concurrency';

/* global d3 */

const dLog = console.debug;

export default Component.extend({
  blockService: service('data/block'),
  controls : service(),
  apiServers : service(),
  selected : service('data/selected'),

  taskGet : alias('blockService.getBlocksOfFeatures'),

  serverTabSelected : alias('controls.serverTabSelected'),

  matchAliases : true,

  /*----------------------------------------------------------------------------*/
  actions : {
    loadBlock(block) {
      this.sendAction('loadBlock', block);
    },
    updateFeaturesInBlocks(featuresInBlocks) {
      this.sendAction('updateFeaturesInBlocks', featuresInBlocks);
    },
    getBlocksOfFeatures : function () {
      console.log("getBlocksOfFeatures", this);
      let 
        activeFeatureList = this.get('activeFeatureList'),
      selectedFeatureNames = ! activeFeatureList ?
        this.queryParamsState.searchFeatureNames.value?.split(',') :
        activeFeatureList.hasOwnProperty('selectedFeatures') ?
        activeFeatureList.selectedFeatures
        : activeFeatureList.featureNameList,
      /** this.blocksUnique() doesn't return blocksUnique because that value is
       * available only after a promise resolves. If the input for the search is
       * empty, then set blocksOfFeatures to []. */
      blocksUnique =
        (activeFeatureList ? activeFeatureList.empty : ! selectedFeatureNames.length) ? []
        : this.blocksUnique(selectedFeatureNames);
      if (activeFeatureList?.empty)
        this.set('blocksOfFeatures', blocksUnique);
    },

    /** not used - the requirements shifted from setting the axis brushes from
     * the outer features to showing ticks for all found features.  */
    brushFeatures : function () {
      this.brushFeatures();
    }
  }, // actions

  matchAliasesChanged(value) {
    dLog('matchAliasesChanged', value, this.matchAliases);
  },


  /*------------------------------------------------------------------------------*/

  /** From the result of feature search, group by block.
   * The result is expressed in 2 forms, for different presentations :
   * . set in .blocksOfFeatures for display in goto-feature-list.hbs
   * . via action updateFeaturesInBlocks, for display in axis-ticks-selected
   * @return undefined
   */
  blocksUnique : function (selectedFeatureNames) {
      let blockService = this.get('blockService');
      function peekBlock(block) {
        return blockService.peekBlock(block.id); };
      let serverTabSelectedName = this.get('serverTabSelected'),
      serverTabSelected = serverTabSelectedName && this.get('apiServers').lookupServerName(serverTabSelectedName),
      apiServer = serverTabSelected || this.get('apiServers.primaryServer');

      let taskGet = this.get('taskGet'); // blockService.get('getBlocksOfFeatures');
      let matchAliases = this.matchAliases;
      let blockTask = taskGet.perform(apiServer, matchAliases, /*blockId*/ undefined, selectedFeatureNames)
        .then((result) => {
          /** result is : matchAliases ? {features, aliases} : [feature, ...] */
          let features = matchAliases ? result.features : result;
          if (matchAliases) {
            let
            aliasFeatureNamesSet = result.aliases
              .reduce((result, a) => {
                result.add(a.string1);
                result.add(a.string2);
                return result;
              }, new Set()),
            aliasFeatureNames = Array.from(aliasFeatureNamesSet);
            this.set('aliases', aliasFeatureNames);
          }
          dLog("getBlocksOfFeatures", selectedFeatureNames[0], features);

          
          let featuresAliases = result.aliases && this.features2Aliases(selectedFeatureNames, features, result.aliases);
          this.set('featuresAliases', featuresAliases);

          /** copy feature search results to the list of clicked features,
           * for which triangles are displayed.  */
          this.set('selected.features', features);
          this.get('selected').featureSearchResult(features);

          let blockIds = new Set(),
          blockCounts = {},

          n = d3.nest()
            .key(function(f) { return f.get('blockId.id'); /* was f.blockId */ })
            .entries(features),
          n1=n.sort(function (a,b) { return b.values.length - a.values.length; }),
          // n1.map(function (d) { return d.key; }),
          /** augment d.key : add references to the (block) record. */
          blocksUnique = n1.map(function (d) {
            /** in initial implementation data was just the attribute data - a POJO 
             * (i.e. data = dv.block, block = peekBlock(data) );
             * it is now an ember object and the JSON data is not retained.
             * The features in d.values[] have the same .blockId - use [0] to the block.
             */
            let dv = d.values[0],
            block = dv.get('blockId'),
            /** .id and .record are the id and record of the block. */
            key = {id: d.key, record : block},
            /** .values are the features within the block */
            result = {key : key, values : d.values};
            dLog('blocksUnique', d, dv, 'result', result);
            return result; });

          /* entry-block-add.hbs is displaying {{entry.count}}.
           * Instead of modifying the store object, this can result in a
           * mapping, or be done in a lookup action, which is passed to
           * entry-block-add
           */
          n1.forEach(function (d) {
            /** this peekBlock() is also done in the above n1.map(), and they
             * could be integrated.  */
            let block = blockService.peekBlock(d.key);
            /** if the block is a copy from another server, then block here will be undefined.
             * There doesn't seem to be much value in including them in features search results;  the other server may not be connected.
             */
            if (block) {
              block.set('count', d.values.length);
            }
          });

          this.set('blocksOfFeatures', blocksUnique);

          /** convert nest [{key, values}..] to hash [key] : values,
           * used in e.g. axis-ticks-selected */
          let featuresInBlocks = n.reduce(
            function (result, value) { result[value.key] = value.values; return result; },
            {} );
          console.log('featuresInBlocks', featuresInBlocks);
          this.send('updateFeaturesInBlocks', featuresInBlocks);

        });
  },

  /*------------------------------------------------------------------------------*/

  /** Given the features and aliases resulting from featureAliasSearch(),
   * determine which features were the result of an alias match.
   * Calculate the mapping from feature name to aliases for both :
   * . search: the search input feature names, and
   * . result: the result features which are not in the the search input feature names
   * @param featureNames  selectedFeatureNames
   * @return {search, result} : 2 objects mapping from search input feature names
   * and result feature names, respectively,
   * to matched aliases (names)
   */
  features2Aliases(featureNames, features, aliases) {
    let
    searchNames = featureNames.reduce((result, name) => { result.add(name); return result;}, new Set()),
    aliasesOfName = aliases.reduce((result, alias) => {
      (result[alias.string1] ||= []).push(alias.string2);
      (result[alias.string2] ||= []).push(alias.string1);
      return result;
    }, {}),
    searchAliases = featureNames.reduce(collateAliasesOfNames, {}),
    featureNamesSource = features.reduce((result, f) => collateAliasesOfNames(result, f.name), {});
    function collateAliasesOfNames(result, name) {
      let aliasA;
      /** multiple features may have the same name, and hence the same aliases. */
      if (! result[name] && (aliasA = aliasesOfName[name])) {
        result[name] = aliasA; }
      return result;
    };
    let results = {search : searchAliases, result : featureNamesSource};
    dLog('features2Aliases', results, featureNames, features, aliases, searchNames, aliasesOfName);
    return results;
  },

  /*------------------------------------------------------------------------------*/


  /** didRender() is called in this component and in the child component
   * feature-list for each keypress in {{input value=featureNameList}} in the
   * child,  so the call to lookupFeatureList(), identifying featureList,
   * is done in didInsertElement().
   */
  didInsertElement() {
    this._super(...arguments);
    this.lookupFeatureList();
  },

  /** Identify the feature-list child component.
   */
  lookupFeatureList() {
    /** for trace */
    const fnName = 'lookupFeatureList';

    /** possibly CF on childViews.@each */
    let children = this.get('childViews'),
    /** Currently the feature-list is the first of 2 child views
     * Can recognise the feature-list component via c.hasOwnProperty('featureNameList') or c.activeFeatureList or c.get('activeFeatureList');
     */
    lists = children.filter(function (c) { return c.activeFeatureList || c.get('activeFeatureList'); }),
    list = lists && lists.length && lists[0];
    console.assert(lists.length === 1, fnName + '() : list.length === 1');
    console.assert(list === children[0], fnName + '() : list === children[0]');
    this.set('featureList', list);
  },
  activeFeatureList : alias('featureList.activeFeatureList'),

  loading : alias('taskGet.isRunning'),

  refreshClassNames : computed('loading', function () {
    let classNames = "btn btn-info pull-right";
    return this.get('loading') ? classNames + ' disabled' : classNames;
  }),

  brushFeatures() {
  }

});
