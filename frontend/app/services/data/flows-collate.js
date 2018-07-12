
import Service from '@ember/service';

/*----------------------------------------------------------------------------*/

import { Flow } from "../../utils/flows";


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

flows = 
  {
    // direct path() uses featureAxes, collated by collateStacks1();
    direct: new Flow("direct", true, false, collateStacks1/*undefined*/),
    U_alias: new Flow("U_alias", false, false, collateStacks1),	// unique aliases
    alias: new Flow("alias", false, true, collateStacksA)	// aliases, not filtered for uniqueness.
  };
// flows.U_alias.visible = flows.U_alias.enabled = false;
// flows.alias.visible = flows.alias.enabled = false;
// flows.direct.visible = flows.direct.enabled = false;
flows.direct.pathData = d3Features = [];
// if both direct and U_alias are enabled, only 1 should call collateStacks1().
if (flows.U_alias.enabled && flows.direct.enabled && (flows.U_alias.collate == flows.direct.collate))
  flows.direct.collate = undefined;

flows.U_alias.pathData = [];
flows.alias.pathData = [];


/*----------------------------------------------------------------------------*/

/** Options / configuration which direct the calculations managed by flows, in
 * particular : collate-paths.js and stacks-adj.js
 */
let flowConfig = {
  /** Include direct connections in U_alias, (affects collateStacks1():pathsUnique). */
  directWithAliases : false,
  // let collateStacks = unique_1_1_mapping === 3 ? collateStacksA : collateStacks1;
  /** look at aliases in adjacent Axes both left and right (for unique_1_1_mapping = 3) */
  adjacent_both_dir : true
};

/*----------------------------------------------------------------------------*/

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
  aliased : aliased,
  aliasedDone : aliasedDone,
  /** Additional attributes, set elsewhere:
   * oa : reference to object attributes of draw-map component
   * stackEvents : event bus on which stack events are published : 'expose'
   *   (sent by collate-paths:getAliased(), listened to by draw/link-path)
   *   (value is the draw-map component, which is Evented).
   */

  init : function() {
    console.log('flows-collate init', this);
    flowsServiceInject_collatePaths(this);
    flowsServiceInject_utilsDrawFlowControls(this);
    flowsServiceInject_stacksAdj(this);
  }
  
});

/*----------------------------------------------------------------------------*/
