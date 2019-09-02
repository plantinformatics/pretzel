import Ember from 'ember';

import Service from '@ember/service';
const { inject: { service } } = Ember;

/*----------------------------------------------------------------------------*/

import { Flow } from "../../utils/flows";

import { axisId2Name } from '../../utils/stacks';



import {
  flowsServiceInject as flowsServiceInject_collatePaths,
  collateStacks, countPaths, countPathsWithData,
  collateData, collateFeatureClasses, maInMaAG, collateStacks1,
  pathsUnique_log, log_maamm, log_ffaa, mmaa2text,
  getAliased, collateStacksA, objPut,
  aliasesText, aliasText,
  addPathsToCollation, addPathsByReferenceToCollation,
  storePath, filterPaths,
  collateFeatureMap, concatAndUnique, featureStackAxes,
  collateMagm
} from "../../utils/draw/collate-paths";

import { flowsServiceInject as flowsServiceInject_utilsDrawFlowControls } from "../../utils/draw/flow-controls";
import { flowsServiceInject as flowsServiceInject_stacksAdj } from "../../utils/stacks-adj";

/*----------------------------------------------------------------------------*/
let d3Features;
/*----------------------------------------------------------------------------*/

/** Expect to drop this flag after adding reverse check (bijective) on U_alias.
 * This is superceded by the addition of flag ?options=uAlias.
 */
const flowsEnableUAlias = true;


/** Defined and manage computation flows which which collate data to support
 * path calculation.
 *
 * flows.U_alias.pathData, aka pathsUnique :
 * path data in unique mode. [feature0, feature1, a0, a1]
 *
 * flows.alias.pathData, aka `put` -  Paths - Unique, from Tree,
 * is re-calculated by filterPaths()
 *
 * Flow.prototype.pathData = undefined;
 *
 */
let flows;

const
desc1 = 'Draw paths between features',
desc_direct = desc1 + ' of the same name (eg: markers)',
desc_alias = desc1 + ' linked by aliases (eg: syntenic genes or alternate marker names)',
desc_U_alias = desc_alias.replace(/aliases/, 'unique aliases')
;

flows = 
  {
    // Flow(name, title, description, direct, unique, collate)
    // direct path() uses featureAxes, collated by collateStacks1();
    direct: new Flow("direct", "Direct", desc_direct, true, true, collateStacks1/*undefined*/),
    U_alias: new Flow("U_alias", "Aliases (unique)", desc_U_alias, false, true, collateStacks1),	// unique aliases
    /* if options.uAlias, ' (non-unique)' is appended to .title in flow-controls:willRender(),
     * and inserted into .description
     */
    alias: new Flow("alias", "Aliases", desc_alias, false, false, collateStacksA)	// aliases, not filtered for uniqueness.
  };
/** Set .visible and .enabled to the given value.
 * This is currently seen as configuration - not something the user changes during runtime.
 * The initial / default value of .enabled is true.
 * @param enable  true or false
 */
Flow.prototype.enable = function (enable)
{
  this.visible = this.enabled = enable;
};
// flows.direct.visible = flows.direct.enabled = false;

flows.U_alias.enable(flowsEnableUAlias);
flows.direct.pathData = d3Features = [];
// if both direct and U_alias are enabled, only 1 should call collateStacks1().
if (flows.U_alias.enabled && flows.direct.enabled && (flows.U_alias.collate == flows.direct.collate))
  flows.U_alias.collate = undefined;

// flows.direct.visible = false;
// flows.alias.visible = false;

flows.U_alias.pathData = [];
flows.alias.pathData = [];


/*----------------------------------------------------------------------------*/

/** Options / configuration which direct the calculations managed by flows, in
 * particular : collate-paths.js and stacks-adj.js
 */
let flowConfig = {
  /** Include direct connections in U_alias, (affects collateStacks1():pathsUnique). */
  directWithAliases : false,
  /** feature.aliases is no longer returned by the server in api/blocks; instead
   * the api/Blocks/paths route returns the aliases separately.  */
  featureContainsAliases : false,
  // let collateStacks = unique_1_1_mapping === 3 ? collateStacksA : collateStacks1;
  /** look at aliases in adjacent Axes both left and right (for unique_1_1_mapping = 3)
   * The paths / aliases retrieved from the backend server are symmetric.
   * adjacent_both_dir can be specific to a flow, i.e. moved into Flow.
   */
  adjacent_both_dir : false // === featureContainsAliases
};

/*----------------------------------------------------------------------------*/

// this is replaced by receiveChr():d3Features.push(feature)
//creates a new Array instance from an array-like or iterable object.
// let d3Features = Array.from(oa.d3FeatureSet);
/** Indexed by featureName, value is a Set of Axes in which the feature is present.
 * Currently featureName-s are unique, present in just one axis (Chromosome),
 * but it seems likely that ambiguity will arise, e.g. 2 assemblies of the same Chromosome.
 * Terminology :
 *   genetic map contains chromosomes with features;
 *   physical map (pseudo-molecule) contains genes
 */
let featureAxisSets = {};

/*----------------------------------------------------------------------------*/
/** Alias groups : aliasGroup[aliasGroupName] : [ feature ]    feature references axis and array of aliases */
let aliasGroup = {};


/** Map from feature names to axis names.
 * Compiled by collateFeatureMap() from z[], which is compiled from d3Data.
 */
let featureToAxis = {};
/** Map from feature names to axis names, via aliases of the feature.
 * Compiled by collateFeatureMap() from z[], which is compiled from d3Data.
 */
let featureAliasToAxis = {};


// results of collateData()
let
  /** axis / alias : feature    axisFeatureAliasToFeature[axis][feature alias] : [feature] */
  axisFeatureAliasToFeature = {},
/** axis/feature : alias groups       axisFeatureAliasGroups[axis][feature] : aliasGroup
 * absorbed into z[axis][feature].aliasGroupName
 axisFeatureAliasGroups = {},  */
// results of collateMagm() - not used
/** feature alias groups Axes;  featureAliasGroupAxes[featureName] is [stackIndex, a0, a1] */
featureAliasGroupAxes = {};

/** class names assigned by colouredFeatures to alias groups, indexed by alias group name.
 * result of collateFeatureClasses().
 */
let aliasGroupClasses = {};


// results of collateStacks1()
let
  /** feature : axis - axis    featureAxes[feature] : [[feature, feature]] */
  featureAxes = {},
/** Not used yet; for pathAliasGroup().
 *  store : alias group : axis/feature - axis/feature   aliasGroupAxisFeatures[aliasGroup] : [feature, feature]  features have refn to parent axis
 * i.e. [aliasGroup] -> [feature0, a0, a1, za0[feature0], za1[feature0]] */
aliasGroupAxisFeatures = {};

/** results of collateAdjacentAxes() */
let adjAxes = {};
/** results of collateStacksA() and from addPathsToCollation() */
let aliased = {};
let aliasedDone = {};


/*----------------------------------------------------------------------------*/

export default Service.extend({
  block: service('data/block'),
  axisBrush: service('data/axis-brush'),
  pathsPro : service('data/paths-progressive'),

  flows : flows,

  flowConfig : flowConfig,

  d3Features : d3Features,
  featureAxisSets : featureAxisSets,
  aliasGroup : aliasGroup,
  featureToAxis : featureToAxis,
  featureAliasToAxis : featureAliasToAxis,
  axisFeatureAliasToFeature : axisFeatureAliasToFeature,
  featureAliasGroupAxes : featureAliasGroupAxes,
  aliasGroupClasses : aliasGroupClasses,
  featureAxes : featureAxes,
  aliasGroupAxisFeatures : aliasGroupAxisFeatures,
  adjAxes : adjAxes,
  adjAxesArr : [],
  adjAxesCount : 0,
  aliased : aliased,
  aliasedDone : aliasedDone,
  /** Additional attributes, set elsewhere:
   * oa : reference to object attributes of draw-map component
   * stackEvents : event bus on which stack events are published : 'expose'
   *   (sent by collate-paths:getAliased(), listened to by draw/link-path)
   *   (value is the draw-map component, which is Evented).
   */

  init : function() {
    this._super(...arguments);
    console.log('flows-collate init', this);
    flowsServiceInject_collatePaths(this);
    flowsServiceInject_utilsDrawFlowControls(this);
    flowsServiceInject_stacksAdj(this);
  },
  enabledFlows : Ember.computed('flowConfig.uAlias', function () {
    let uAlias = flowConfig.uAlias,
    flows = this.get('flows');
    if (flows.U_alias.enabled != uAlias)
      flows.U_alias.enable(uAlias);
      
    let result = {};
    for (let f in flows)
      if (flows[f].enabled)
        result[f] = flows[f];
    console.log('enabledFlows', uAlias, flows.U_alias.enabled, result);
    return result;
  }),

  /** From adjAxes (which records all block adjacencies in both directions), filter to
   * output just 1 pair [b0, b1] for each pair of adjacent blocks.  The criteria b0 < b1 is
   * used to select the direction which is used; this is stable during axis
   * dragging which changes left-to-right order and stacking.
   * The values b0, b1 are block IDs.
   */
  blockAdjIds : Ember.computed('block.viewedIds.[]', 'adjAxesArr.[]', function () {
    let viewedIds = this.get('block.viewedIds');
    let axesP = this.get('oa.axesP');
    console.log('blockAdjIds', viewedIds, axesP);
    let blockAdjIds = Ember.run(this, convert);
    /** Convert the hash adjAxes, e.g. adjAxes[b0] === b1, to an array of ordered pairs [b0, b1]
     */
    function convert () {
    let adjAxes = this.get('adjAxes'),
    blockAdjIds2 =
      Object.keys(adjAxes).reduce(function(result, b0Name) {
        let b0 = adjAxes[b0Name];
        console.log(b0Name, axisId2Name(b0Name), b0.length);
        for (let b1i=0; b1i < b0.length; b1i++) {
          let b1Name = b0[b1i];
          let // direction = b0Name < b1Name,
            orderedPair = [b0Name, b1Name].sort();
          // if (direction)
            result.push(orderedPair);
          // console.log(result);
        }
        return result;
      }, []);
      return blockAdjIds2;
    }
    console.log('blockAdjIds', blockAdjIds);
    return blockAdjIds;
  }),
  blockAdjs : Ember.computed('blockAdjIds.[]', function () {
    let pathsPro = this.get('pathsPro'),
    blockAdjIds = this.get('blockAdjIds'),
    records = blockAdjIds.map(function (blockAdjId) {
      let record = pathsPro.ensureBlockAdj(blockAdjId);
      console.log('blockAdjId', blockAdjId, blockAdjId[0], blockAdjId[1], record);
      return record;
    });
    return records;
  })

});

/*----------------------------------------------------------------------------*/
