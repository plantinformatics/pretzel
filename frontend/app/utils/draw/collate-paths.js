import Ember from 'ember';

const { inject: { service } } = Ember;

import { isEqual } from 'lodash/lang';

import { Block, /*Stacked, Stack,*/ stacks /*, xScaleExtend, axisRedrawText*/, axisId2Name } from '../stacks';
import { collateAdjacentAxes, log_adjAxes, log_adjAxes_a } from '../stacks-adj';

import { isOtherField } from '../field_names';
import { breakPoint } from '../breakPoint';


/* global require */
/*global d3 */

/*----------------------------------------------------------------------------*/
/* created from functions split out of draw-map.js (commit 5db9073). */
/*----------------------------------------------------------------------------*/

/** Used only by featureLookupName(), to read feature name and blockId of a
 * feature which is already loaded into the store.
 * can only inject service into an Ember object, not a library;
 * collate-paths seems likely to be a service, so then it can inject store.
 let store = service('store');
 */
let flowsService; // = service('data/flows-collate');
let flows;
function flowsServiceInject(flowsService_)
{ flowsService = flowsService_;
  flows = flowsService.get('flows');
}
let oa__;
function oa_() { return oa__ || (oa__ = flowsService.get('oa')); }


const trace_alias = 1;  // currently no trace at level 1.
const trace_path = 0;
/** enable trace of adjacency between axes, and stacks. */
const trace_adj = 1;



/*----------------------------------------------------------------------------*/

function collateStacks()
{
  console.log('collateStacks', flowsService, flows);
  d3.keys(flows).forEach(function(flowName) {
    let flow = flows[flowName];
    if (flow.enabled && flow.collate)
    {
      if (trace_adj | trace_path)
        console.log('collateStacks', flowName);
      flow.collate();
    }
  });
}

/*----------------------------------------------------------------------------*/

/** total the # paths collated for the enabled flows.
 * Used to adjust the stroke-width and stroke-opacity.
 */
function countPaths(svgRoot)
{
  console.log("countPaths", svgRoot);
  if (svgRoot)
  {
    let nPaths = 0;
    d3.keys(flows).forEach(function(flowName) {
      let flow = flows[flowName];
      if (flow.enabled && flow.collate)
      {
        nPaths += flow.pathData.length;
        console.log("countPaths", flow.name, flow.pathData.length, nPaths);
      }
    });
    svgRoot.classed("manyPaths", nPaths > 200);
  }
}
/** Same as countPaths(), but counting only the paths with data, which excludes
 * those which are outside the zoom range.  */
function countPathsWithData(svgRoot)
{
  if (trace_path)
    console.log("countPathsWithData", svgRoot);
  if (svgRoot)
  {
    let paths = Ember.$("path[d!=''][d]"),
    nPaths = paths.length;
    svgRoot.classed("manyPaths", nPaths > 200);
    if (trace_path)
      console.log(nPaths, svgRoot._groups[0][0].classList);
  }
}

/*----------------------------------------------------------------------------*/
/** Construct a unique name for a group of aliases - sort the aliases and catenate them.
 */
function aliasesUniqueName(aliases)
{
  let s = aliases.sort().join("_");
  aliases.name = s;
  return s;
}
let traceCount_featureSet = 0, traceCount_features = 0, traceCount_featureIndex = 0;
/** Ensure that the given feature is referenced in featureIndex[].
 * This is collated in receiveChr(), and should not be needed in
 * collateData(); the purpose of this function is to clarify when & why that
 * is not happening.
 * @param featureId
 * @param featureName
 * @param blockId ID of block which contains feature
 */
function ensureFeatureIndex(featureId, featureName, blockId)
{
  let oa = oa_(), z = oa.z;
  if (! isOtherField[featureName]) {
    let f = z[blockId][featureName];
    /* For genetic maps, features (markers) are unique with a chromosome (block) of a map (dataset).
     * For physical maps, they may not be unique, and hence this verification does not apply. 
     if (f.id != featureId)
     breakPoint('ensureFeatureIndex', 'f.id', f.id, '!= featureId', featureId);
     */

    if (! oa.d3FeatureSet.has(featureName))
    {
      if (traceCount_featureSet++ < 5)
        console.log('d3FeatureSet', featureId, featureName);
      oa.d3FeatureSet.add(featureName);
    }
    if (flowsService.d3Features.indexOf(featureName) < 0)
    {
      if (traceCount_features++ < 5)
        console.log('d3Features', featureName, featureId, blockId);
      flowsService.d3Features.push(featureName);
    }
    if (! oa.featureIndex[featureId])
    {
      if (traceCount_featureIndex++ < 5)
        console.log('featureIndex', featureId, featureName);
      oa.featureIndex[featureId] = f;
    }
  }
};
/** Lookup the featureName and blockId of featureId,
 * and call @see ensureFeatureIndex().
 * @param featureId
 */
function featureLookupName(featureId)
{
  let oa = oa_();
  let featureName, f = oa.featureIndex[featureId];
  if (f)
  {
    featureName = f.get ? f.get('name') : f.name;
  }
  else
  {
    /** see comments above about injecting store. */
    let store = oa.eventBus.get('store');
    let feature = store.peekRecord('feature', featureId),
    // in console .toJSON() was required - maybe just timing.
    block = feature.get('blockId') || (feature = feature.toJSON()).get('blockId'),
    blockId = block.get('id');
    featureName = feature.get('name');
    ensureFeatureIndex(featureId, featureName, blockId);
  }
  return featureName;
};



/** After data is loaded, collate to enable faster lookup in collateStacks() and dragged().
 * for each axis
 *   for each feature
 *     store : ref to parent axis       .axis
 *     store : feature -> array of Axes (or set)  features[feature] : set of Axes
 *     store       aliasGroup[aliasGroup] : [ feature ] feature references axis and array of aliases
 *     {unique name of alias group (sort) : array of : axis / feature / array of aliases}
 *     for each alias
 *       store axis / alias : feature    axisFeatureAliasToFeature[axis][feature alias] : feature
 *       store axis/feature : alias groups  (or was that alias groups to feature)
 *          z[axis][feature].aliasGroupName (maybe later array [aliasGroup])
 * 
 */
function collateData()
{
  let featureAliasGroupAxes = flowsService.featureAliasGroupAxes;
  let oa = oa_();
  d3.keys(oa.z).forEach(function(axis) {
    let za = oa.z[axis];
    // console.log("collateData", axis, za);
    if (featureAliasGroupAxes[axis] === undefined)
      featureAliasGroupAxes[axis] = {};
    let axisFeatureAliasToFeature = flowsService.axisFeatureAliasToFeature;
    if (axisFeatureAliasToFeature[axis] === undefined)
    {
      axisFeatureAliasToFeature[axis] = {};
      let aafa  = axisFeatureAliasToFeature[axis];
      d3.keys(za).forEach(function(feature) {
        if ((feature != "mapName") && (feature != "chrName")
            && ! isOtherField[feature])
        {
          try
          {
            za[feature].axis = oa.z[axis]; // reference from feature to parent axis
            // console.log("collateData", axis, za, za[feature]);
          } catch (exc)
          {
            console.log("collateData", axis, za, za[feature], exc);
            breakPoint();
          }
          let featureAxisSets = flowsService.featureAxisSets;
          if (featureAxisSets[feature] === undefined)
            featureAxisSets[feature] = new Set();
          featureAxisSets[feature].add(axis);

          /** fas is undefined now that featureContainsAliases is false.  */
          let feature_ = za[feature], fas = feature_.aliases;
          feature_.name = feature;
          if (fas && fas.length)
          {
            /** Include feature's own name in the name of the group of its
             * aliases, because if aliases are symmetric, then e.g.
             *  map/chr1 : F1  {f2 ,f3 }
             *  map/chr2 : f2  {F1 ,f3 }, f3  {F1 ,f2 }
             * i.e. there is just one alias group : {F1 ,f2 ,f3 }
             * The physical data seems to contain symmetric alias groups of 5-20
             * genes ("features"); so recognising that there is just one alias
             * group can significantly reduce processing and memory.
             */
            let aliasGroupName = aliasesUniqueName(fas.concat([feature]));
            let aliasGroup = oa.aliasGroup;
            if (aliasGroup[aliasGroupName] === undefined)
              aliasGroup[aliasGroupName] = [];
            aliasGroup[aliasGroupName].push(feature_);

            for (let featureAlias of fas)
            {
              // done above, could be moved here, if still required :
              // za[a] = {location: feature_.location};

              if (aafa [featureAlias] === undefined)
                aafa [featureAlias] = [];
              aafa [featureAlias].push(feature);
            }

            if (feature_.aliasGroupName)
              // should be just 1
              console.log("[feature] aliasGroupName", axis, feature, feature_, aliasGroupName);
            else
              feature_.aliasGroupName = aliasGroupName;
          }
          // ensureFeatureIndex(featureID, feature, axis);
        }
      });
    }
  });
}

/** Collate the classes of features via alias groups.
 * Inputs : z (including .aliasGroupName), featureScaffold (from colouredFeatures)
 * Outputs : aliasGroupClasses
 */
function collateFeatureClasses(featureScaffold)
{
  let aliasGroupClasses = flowsService.aliasGroupClasses;
  let oa = oa_();
  d3.keys(oa.z).forEach(
    function(axisName)
    {
      let za = oa.z[axisName];
      d3.keys(za).forEach(
        function(featureName)
        {
          if (! isOtherField[featureName])
          {
            let  feature_ = za[featureName],
            aliasGroupName = feature_.aliasGroupName,
            fas = feature_.aliases;
            if (fas && fas.length > 0)
            {
              // fas.length > 0 implies .aliasGroupName is defined
              let agc = aliasGroupClasses[aliasGroupName];
              if (agc === undefined)
              {
                aliasGroupClasses[aliasGroupName] = new Set();
                agc = aliasGroupClasses[aliasGroupName];
              }
              // feature_.name === featureName;
              for (let i=0; i<fas.length; i++)
              {
                let fi = fas[i], className = featureScaffold[fi];
                if (className)
                  agc.add(className);
              }
            }
          }
        });
    });
}


/**             is feature f1  in an alias group of a feature f0  in axis0  ?
 * @return   the matching aliased feature f0  if only 1
 */
function maInMaAG(axis0, axis1, f1 )
{
  /** Return the matching aliased feature if only 1; afC is the count of matches */
  let featureToAxis, afC=0;
  /** aafa  inverts the aliases of f1 ; i.e. for each alias fa  of f1 , aafa [fa ] contains f1 .
   * so aafa [f1 ] contains the features which alias to f0 
   * If there are only 1 of those, return it.
   * ?(f1  if f0  is in the aliases of a0:f1 )
   */
  let aafa  = flowsService.axisFeatureAliasToFeature[axis0.axisName],
  fa  = aafa [f1 ],
  oa = oa_(),
  z0 = oa.z[axis0.axisName];
  let afs = [];
  if (fa )
    for (let fai=0; fai<fa .length; fai++)
  {
      let fai_ = fa [fai];
      if (z0[fai_])
      {
        featureToAxis = fai_;
        afC++;
        if (trace_alias > 1)
          afs.push(featureToAxis); // for devel trace.
      }
    }
  if (trace_alias > 1)
    console.log("maInMaAG()", axis0.mapName, axis1.mapName, f1 , featureToAxis, afC, afs);
  if (afC > 1)
    featureToAxis = undefined;
  else if (trace_alias > 1)
  {
    console.log(aafa , fa , z0);
  }
  return featureToAxis;
}

/** At time of axis adjacency change, collate data for faster lookup in dragged().
 *
 *   for each pair of adjacent stacks

 *       for each feature in axis
 *         lookup that feature in the other axis directly
 *           store : feature : axis - axis    featureAxes[feature] : [[feature, feature]]
 *         any connection from a0:feature0 to a1 via alias :
 *         lookup that feature in the other axis via inverted aliases
 *           store : alias group : axis/feature - axis/feature   aliasGroupAxisFeatures[aliasGroup] : [feature, feature]  features have refn to parent axis
 *         unique 1:1 connection between a0:feature0 and a1:feature1 :
 *           for each feature, feature1, in AXIS1
 *             consider direct and any alias of a0:feature0
 *             is feature1 in feature0 alias group ?
 *             is feature0 in feature1 alias group ?
 *             (compile hash from each feature alias group)
 *             for axis-axis data is list of ags

 * Results are in pathsUnique, which is accessed via Flow.pathData
 */
function collateStacks1()
{
  let
    featureAxes = flowsService.featureAxes = {},
  aliasGroupAxisFeatures = flowsService.aliasGroupAxisFeatures,
  pathsUnique = flows.U_alias.pathData = [];
  flowsService.set('pathsUnique', pathsUnique);
  let oa = oa_();

  for (let stackIndex=0; stackIndex<stacks.length-1; stackIndex++) {
    let s0 = stacks[stackIndex], s1 = stacks[stackIndex+1],
    fAxis_s0 = s0.childBlocks(),
    fAxis_s1 = s1.childBlocks();
    if (fAxis_s0.length === 0 || fAxis_s1.length === 0)
    {
      console.log("fAxis_s0,1.length", fAxis_s0.length, fAxis_s1.length);
      // stacks.log();
    }
    // Cross-product of the two adjacent stacks
    for (let a0i=0; a0i < fAxis_s0.length; a0i++) {
      let a0 = fAxis_s0[a0i], za0 = a0.z, a0Name = a0.axisName;
      for (let a1i=0; a1i < fAxis_s1.length; a1i++) {
        let a1 = fAxis_s1[a1i], za1 = a1.z || /* mask error in stack.childAxisNames(true) */ oa.z[a1.axisName];
        d3.keys(za0).forEach(function(feature0) {
          if (! isOtherField[feature0])
          {
            /** a0, a1 could be derived from za0[feature0].axis, za1[feature0].axis */
            let faa = [feature0, a0, a1, za0[feature0], za1[feature0]];
            if (za1[feature0])
            {
              if (featureAxes[feature0] === undefined)
                featureAxes[feature0] = [];
              featureAxes[feature0].push(faa);
              if (trace_path > 3)
                console.log(feature0, faa);
            }
            // not used yet; to be shared to pathAliasGroup().
            // any connection from a0:feature0 to a1 via alias :
            let aliasGroup = za0[feature0].aliasGroupName;
            if (false && aliasGroup)
            {
              if (aliasGroupAxisFeatures[aliasGroup] === undefined)
                aliasGroupAxisFeatures[aliasGroup] = [];
              aliasGroupAxisFeatures[aliasGroup].push(faa);
            }

            /* If feature0 is in an alias of a1, 
             * maInMaAG return the feature if just 1
             * 
             */

            let
              aliasedM0,
            aliasedM1 = maInMaAG(a1, a0, feature0),
            directWithAliases = flowsService.flowConfig.directWithAliases,
            showAsymmetricAliases = flowsService.flowConfig.viewOptions.showAsymmetricAliases,
            isDirect = directWithAliases && oa.z[a1.axisName][feature0] !== undefined;
            let differentAlias;
            if (aliasedM1 || showAsymmetricAliases)
            {
              /* alias group of feature0 may not be the same as the alias group
               * which links aliasedM1 to a0, but hopefully if aliasedM0 is
               * unique then it is feature0. */
              aliasedM0 = maInMaAG(a0, a1, aliasedM1);
              /** aliasedM1 is the alias of feature0, so expect that the alias
               * of aliasedM1 is feature0.  But some data seems to have
               * asymmetric alias groups.  In that case, we classify the alias
               * as non-unique. */
              differentAlias = aliasedM0 != feature0;
              if (trace_alias > 1 && differentAlias)
              {
                let axisFeatureAliasToFeature = flowsService.axisFeatureAliasToFeature;
                console.log("aliasedM1", aliasedM1, "aliasedM0", aliasedM0, feature0, za0[feature0], za1[aliasedM1], axisFeatureAliasToFeature[a1.axisName][feature0], axisFeatureAliasToFeature[a0.axisName][aliasedM1]);
              }

              let d0 = feature0, d1 = aliasedM1;

              if (trace_alias > 1)
                console.log("collateStacks()", d0, d1, a0.mapName, a1.mapName, a0, a1, za0[d0], za1[d1]);

            }
            let
              nConnections = 0 + (aliasedM1 !== undefined) + (isDirect ? 1 : 0);
            if ((nConnections === 1) && (showAsymmetricAliases || (differentAlias !== true))) // unique
            {
              let 
                /** i.e. isDirect ? feature0 : aliasedM1 */
                feature1 = aliasedM1 || feature0,
              ffaa = [feature0, feature1, a0, a1];
              pathsUnique.push(ffaa);
              // console.log(" pathsUnique", pathsUnique.length);
            }
          }
        });
      }
    }
  }
  if (pathsUnique)
    console.log("collateStacks", " featureAxes", d3.keys(featureAxes).length, ", pathsUnique", pathsUnique.length);
  if (trace_path > 4)
  {
    for (let featurej in featureAxes) {
      let faNj = featureAxes[featurej];
      console.log("collateStacks1", featurej, faNj.length);
      for (let i = 0; i < faNj.length; i++)
      {
        log_maamm(faNj[i]);
      }
    }
  }
  if (trace_path > 3)
  {
    pathsUnique_log(pathsUnique);
  }
}
function pathsUnique_log(pathsUnique)
{
  if (pathsUnique)
    for (let pi=0; pi<pathsUnique.length; pi++)
  {
      let p = pathsUnique[pi];
      // log_ffaa() give more detail than this.
      // console.log(p[0], p[1], p[2].mapName, p[3].mapName);
      log_ffaa(p);
    }
}
/** log content of featureAxes[featureName][i] */
function log_maamm(f)
{
  let     [feature0, a0, a1, f0 , f1 ] = f,
  oa = oa_(),
  z = oa.z;
  console.log(feature0, a0.mapName, a0.axisName, a1.mapName, a1.axisName, f0 .location, f1 .location);
}
function log_ffaa(ffaa)
{
  if ((ffaa === undefined) || (typeof ffaa == "string") || (ffaa.length === undefined))
    console.log(ffaa);
  else
  {
    let     [feature0, feature1, a0, a1, direction, aliasGroupName] = ffaa,
    oa = oa_(),
    z = oa.z,
    f0  = z[a0.axisName][feature0],
    f1  = z[a1.axisName][feature1];
    console.log(feature0, feature1, a0.mapName, a0.axisName, a1.mapName, a1.axisName, f0 .location, f1 .location, direction, aliasGroupName);
  }
}
function mmaa2text(ffaa)
{
  let s = "";
  if ((ffaa === undefined) || (typeof ffaa == "string") || (ffaa.length === undefined))
    s += ffaa;
  else
  {
    let     [feature0, feature1, a0, a1, direction, aliasGroupName] = ffaa,
    oa = oa_(),
    z = oa.z,
    f0  = z[a0.axisName][feature0],
    f1  = z[a1.axisName][feature1];
    s += feature0 + ", " + feature1 + ", " + a0.mapName + ", " + a0.axisName + ", " + a1.mapName + ", " + a1.axisName + ", " + f0 .location + ", " + f1 .location + ", " + direction + ", " + aliasGroupName;
  }
  return s;
}

/*----------------------------------------------------------------------------*/

//-paths
/** Check if aliases between axisName and axisName1 have been stored.  */
function getAliased(axisName, axisName1)
{
  /* If there are aliases between axisName, axisName1 then
   * aliased[axisName][axisName1] (with apNames in lexicographic
   * order) will be defined, but because some adjacencies may not
   * have aliases, aliasedDone is used.
   */
  let a0, a1;
  let aliasedDone = flowsService.aliasedDone;
  let adjacent_both_dir = flowsService.flowConfig.adjacent_both_dir;
  let stackEvents = flowsService.stackEvents;
  /* If ! adjacent_both_dir then if the aliases have been requested for one
   * direction <a0, a1> then there is no need to request <a1, a0> - the result
   * is symmetric.
   */
  if (! adjacent_both_dir && (axisName > axisName1))
  { a0 = axisName1; a1 = axisName; }
  else
  { a0 = axisName; a1 = axisName1; }
  let a = aliasedDone[a0] && aliasedDone[a0][a1];
  if (trace_adj > 1)
  {
    console.log("getAliased filter", axisName, axisId2Name(axisName), axisName1, axisId2Name(axisName1), a);
  }
  if (! a)
  {
    if (aliasedDone[a0] === undefined)
      aliasedDone[a0] = {};
    aliasedDone[a0][a1] = true;
    /* The caller will now calculate aliases locally, and the following requests aliases from the backend.
     * Either of these 2 can be made optional. */
    stackEvents.trigger('expose', axisName, axisName1);
  }
  return a;
}

/* This has a similar role to collateStacks1(), but is more broad - it just
 * looks at aliases and does not require symmetry; the filter can be customised to
 * require uniqueness, so this method may be as efficient and more general.
 *
 * for asymmetric aliases :
 * for each axis
 *   adjAxes = array (Set?) of adjacent Axes, minus those already in tree[axis0]
 *   for each feature f0  in axis
 *     lookup aliases (features) from f0  (could be to f0 , but seems equiv)
 *       are those aliased features in Axes in adjAxes ?	(use mapping featureAxisSets[featureName] -> Axes)
 *         add to tree, associate duplicates together (coming back the other way)
 *           by sorting axis0 & axis1 in lexicographic order.
 *             aliased[axis0][axis1][f0 ][f1 ]  : [f0 , f1 , axis0, axis1, direction, aliasGroupName]
 *
 * call filterPaths() to collate paths of current adjacencies in put, accessed via Flow.pathData
 */
function collateStacksA()
{
  let aliased = flowsService.aliased;
  collateAdjacentAxes();
  /** result of above collateAdjacentAxes(). */
  let adjAxes = flowsService.adjAxes;
  let adjCount = 0, adjCountNew = 0, pathCount = 0;
  let oa = oa_();
  // could change this to traverse adjAxes (post filter) instead of keys(oa.z)
  d3.keys(oa.z).forEach(
    function(axisName)
    {
      let za = oa.z[axisName];
      let adjs = adjAxes[axisName];
      if (adjs && adjs.length
          &&
          (adjs = adjs.filter(function(axisName1) {
            adjCount++;
            let a = getAliased(axisName, axisName1);
            if (!a) adjCountNew++;
            return ! a; } ))
          &&
          adjs.length)
      {
        if (trace_adj > 1)
        {
          console.log(axisName, axisId2Name(axisName));
          log_adjAxes_a(adjs);
        }
        let trace_count = 1;
        d3.keys(za).forEach(
          function(featureName)
          {
            if (! isOtherField[featureName]) {
              let  feature_ = za[featureName],
              aliasGroupName = feature_.aliasGroupName;

              let fas = feature_.aliases;
              if (fas)
                for (let i=0; i<fas.length; i++)
              {
                  let fi = fas[i],
                  featureAxisSets = flowsService.featureAxisSets,
                  Axes = featureAxisSets[fi];
                  // Axes will be undefined if fi is not in a axis which is displayed.
                  if (Axes === undefined)
                  {
                    if (trace_adj && trace_count-- > 0)
                      console.log("collateStacksA", "Axes === undefined", axisName, adjs, featureName, feature_, i, fi, featureAxisSets);
                  }
                  else
                    // is there an intersection of adjs with Axes
                    for (let id=0; id<adjs.length; id++)
                  {
                      let aj = adjs[id],
                      featureA = oa.z[aj][fi];
                      if (Axes.has(aj))
                      {
                        let // aliasGroupName = featureA.aliasGroupName,
                          direction = axisName < aj,
                        axes = oa.axes,
                        axisName_ = axes[axisName] || stacks.blocks[axisName],
                        aj_ = axes[aj],
                        featureToAxis = [
                          {f: featureName, axis: axisName_},
                          {f: fi, axis: aj_}
                        ],
                        featureToAxis_= [featureToAxis[1-direction], featureToAxis[0+direction]],
                        [f0 , f1 , axis0, axis1] = [featureToAxis_[0].f, featureToAxis_[1].f, featureToAxis_[0].axis, featureToAxis_[1].axis],
                        ffaa = [f0 , f1 , axis0, axis1, direction, aliasGroupName];
                        if (trace_adj && trace_count-- > 0)
                          console.log("ffaa", ffaa, axis0.axisName, axis1.axisName, axisId2Name(axis0.axisName), axisId2Name(axis1.axisName));
                        // log_ffaa(ffaa);
                        // aliased[axis0][axis1][f0 ][f1 ] = ffaa;
                        /* objPut() can initialise aliased, but that is done above,
                         * needed by filter, so result is not used. */
                        objPut(aliased, ffaa, axis0.axisName, axis1.axisName, f0 , f1 );
                        pathCount++;
                      }
                    }
                }
            }

          });
      }
    });
  if (trace_adj)
    console.log("adjCount", adjCount, adjCountNew, pathCount);
  // uses (calculated in) collateAdjacentAxes() : adjAxes, collateStacksA() : aliased.
  filterPaths();
}

/* Both storePath() and collateStacksA() store (in aliased) with
 * k1 < k2, because they rely on their alias connections being symmetric.
 * (for those functions, k3 is a feature on axis k1, and k4 is a feature on axis k2).
 */
function objPut(a, v, k1, k2, k3, k4)
{
  if (a === undefined)
    a = {};
  let A, A_;
  if ((A = a[k1]) === undefined)
    A = a[k1] = {};
  if ((A_ = A[k2]) === undefined)
    A = A[k2] = {};
  else
    A = A_;
  if ((A_ = A[k3]) === undefined)
    A = A[k3] = {};
  else
    A = A_;
  if ((A_ = A[k4]) === undefined)
    A = A[k4] = [];
  else
    A = A_;
  // A is now a[k1][k2][k3][k4]
  /** result is first A[i] which is deep equal to v.  */
  let found = A.find(function (vi) { return isEqual(vi, v); } );
  if (! found)
  {
    A.push(v);
  }
  return a;
}
/** convert aliases to hover text
 * @param aliases array returned by api/Blocks/paths
 * "they're the complete alias object
 * which is something like {"str1": ..., "str2": ..., "namespace1": ..} "
 */
function aliasesText(aliases)
{
  let text = aliases.map(aliasText).join("\n");
  return text;
}
function aliasText(alias)
{
  let text =
    d3.keys(alias).forEach(function(a) {
      return a.toString() + alias[a];
    });
  return text;
}
/** Store the results from api/Blocks/paths request, in the same structure,
 * aliased, which collateStacksA() stores in. */
function addPathsToCollation(blockA, blockB, paths)
{
  if (trace_adj > 1 - (paths.length > 1))
    console.log('addPathsToCollation', blockA, blockB, paths.length,
                Block.longName(blockA), Block.longName(blockB));
  let axisName = blockA, axisName1 = blockB;
  let trace_count_path = 1;
  paths.map(function (p) {
    /* could pass p.featureA, p.featureB to featureLookupName() as blockId;
     * featureName is not in the result. */
    /** example of result : 
     *  {featureA: "5ab0755a3d9b2d6b45839b2f", featureB: "5ab07f5b3d9b2d6b45839b34", aliases: Array(0)}
     * Result contains feature object ids; convert these to names using
     * featureIndex[], as current data structure is based on feature (feature)
     * names - that will change probably. */
    let
      /** the order of p.featureA, p.featureB matches the alias order. */
      aliasDirection = p.featureAObj.blockId === blockA,
    aliasFeatures = [p.featureA, p.featureB],
    /** the order of featureA and featureB matches the order of blockA and blockB,
     * i.e.  featureA is in blockA, and featureB is in blockB
     */
    featureA = aliasFeatures[1-aliasDirection],
    featureB = aliasFeatures[+aliasDirection],
    featureName = featureLookupName(featureA),
    /** If p.aliases.length == 0, then p is direct not alias so put it in featureAxes[] instead.
     * Will do that in next commit because it is useful in first pass to do visual comparison of
     * paths calculated FE & BE by toggling the flow display enables
     * (div.flowButton / flow.visible) "direct" and "alias".
     */
    aliasGroupName = p.aliases.length ? JSON.stringify(p.aliases, null, '  ') : undefined, // was aliasesText(p.aliases),
    fi = featureLookupName(featureB);
    /* if path is direct and not from alias, then check that features are
     * stored, otherwise store them.
     */
    if (! p.aliases.length)
    {
      // verify that p.featureA, p.featureB are in blockA, blockB, respectively.
      let z = oa_().blockFeatureLocation,
      featureIndex = oa_().featureIndex;
      /** Check that the path endpoints are known in blockFeatureLocation.
       * @param featureName name of featureId, or undefined, in which case name
       * is found via featureIndex[]
       */
      function checkFeature(featureId, featureName, blockId) {
        let 
        block = z[blockId],
        location = block && block[featureName || featureIndex[featureId].name];
        if (! location)
          breakPoint('result has additional feature', featureId, featureName, blockId, p, featureIndex[featureId]);
      };
      checkFeature(p.featureA, featureName, blockA);
      checkFeature(p.featureB, fi, blockB);
    }
    else
      storePath(blockA, blockB, featureName, fi, aliasGroupName);
  });

  /* when called from stream, paths.length===1, so don't redraw paths for each path received. */
  filterAndPathUpdateThrottled(paths.length === 1);
}
/** Used by both addPathsToCollation() and addPathsByReferenceToCollation().
 * Those functions can be called from EventStream replies, with 1 path in each response,
 * so use throttle to avoid calling pathUpdateFlow() for every path received. 
 */
function filterAndPathUpdateThrottled(isStream) {
  if (! isStream)
	  filterAndPathUpdate();
  else
	  Ember.run.throttle(filterAndPathUpdate, 200, false);
}
function filterAndPathUpdate() {
  filterPaths();
  /* the results can be direct or aliases, so when the directs are put in
   * featureAxes[], then do pathUpdate(undefined); * for now, just the aliases : */
  /** same value as flowsService.stackEvents; possibly will settle on the latter.  */
  let stackEvents = oa_().eventBus;
  stackEvents.trigger('pathUpdateFlow', undefined, flows["U_alias"]);
  stackEvents.trigger('pathUpdateFlow', undefined, flows["alias"]);
}

/** Store the results from api/Blocks/pathsByReference request, in the same structure,
 * aliased, which collateStacksA() stores in. */
function addPathsByReferenceToCollation(blockA, blockB, referenceGenome, maxDistance, paths)
{
  if ((trace_adj > 1) || (trace_adj && paths.length))
    console.log('addPathsByReferenceToCollation', blockA, blockB, referenceGenome, maxDistance, paths.length, arguments);
  let axisName = blockA, axisName1 = blockB;
  let trace_count_path = 1;
  paths.map(function (p) {
    /** @see addPathsToCollation() for further comments.  */
    let
      featureName = featureLookupName(p.featureA),
    aliasGroupName = p.aliases.length ? JSON.stringify(p.aliases, null, '  ') : undefined,
    fi = featureLookupName(p.featureB);
    if (! p.aliases.length)
    {
      // this API result should not contain directs, only aliases.
      console.log('addPathsByReferenceToCollation empty aliases', p);
    }
    else
      storePath(blockA, blockB, featureName, fi, aliasGroupName);
  });

  filterAndPathUpdateThrottled(paths.length === 1);
}

let trace_count_path;
function storePath(blockA, blockB, featureName, fi, aliasGroupName)
{
  let aliased = flowsService.aliased;
  // factored out of collateStacksA() and addPathsToCollation() above.
  let aj = blockB, // adjs[id],
  axisName = blockA,
  oa = oa_(),
  featureA = oa.z[aj][fi];
  // if (Axes.has(aj))
  {
    /** store paths in an a canonical order; paths between
     * blocks are not dependent on order of the adjacent
     * blocks.
     */
    let // aliasGroupName = featureA.aliasGroupName,
      direction = axisName < aj,
    blockA_ = oa.stacks.blocks[blockA],
    blockB_ = oa.stacks.blocks[blockB],
    /** indexed with direction to produce featureToAxis_[],
     * from which ffaa is extracted so that .axis0 < .axis1.
     */
    featureToAxis = [
      {f: featureName, axis: blockA_},
      {f: fi, axis: blockB_}
    ],
    featureToAxis_= [featureToAxis[1-direction], featureToAxis[0+direction]],
    [f0 , f1 , axis0, axis1] = [featureToAxis_[0].f, featureToAxis_[1].f, featureToAxis_[0].axis, featureToAxis_[1].axis],
    ffaa = [f0 , f1 , axis0, axis1, direction, aliasGroupName];
    function checkFa(f, a) {
      if (! oa.z[a.axisName][f]) {
        console.log(
          'checkFa', f, a._internalModel && a._internalModel.__data, [blockA, blockB, featureName, fi, aliasGroupName],
          aliased, axisName, aj, direction, blockA_, blockB_, featureToAxis, featureToAxis_, ffaa);
      }
    }
    checkFa(f0, axis0);
    checkFa(f1, axis1);
    if (trace_adj && trace_count_path-- > 0)
      console.log("ffaa", ffaa, axis0.axisName, axis1.axisName, axisId2Name(axis0.axisName), axisId2Name(axis1.axisName));
    // log_ffaa(ffaa);
    objPut(aliased, ffaa, axis0.axisName, axis1.axisName, f0 , f1 );
  }
}

/**
 * Results are in put, which is accessed via Flow.pathData
 */
function filterPaths()
{
  /** Paths - Unique, from Tree. */
  let put = flows.alias.pathData = [];
  let pathsUnique = flows.U_alias.pathData = [];
  /** results of collateAdjacentAxes() */
  let adjAxes = flowsService.adjAxes;
  let aliased = flowsService.aliased;

  function selectCurrentAdjPaths(a0Name)
  {
    // this could be enabled by trace_adj also
    if (trace_path > 1)
      console.log("a0Name", a0Name, axisId2Name(a0Name));
    adjAxes[a0Name].forEach(function (a1Name) { 
      /** @see objPut() header comment. */
      let aNames = (a0Name > a1Name)
        ? [a1Name, a0Name]
        : [a0Name, a1Name];
      if (trace_path > 1)
        console.log("a1Name", a1Name, axisId2Name(a1Name), (a0Name > a1Name));
      let b;
      if ((b = aliased[aNames[0]]) && (b = b[aNames[1]]))
        d3.keys(b).forEach(function (f0 ) {
          let b0=b[f0 ];
          let b0_fs = d3.keys(b0),
          b0_fs_n = b0_fs.length;
          d3.keys(b0).forEach(function (f1 ) {
            let b01=b0[f1 ];
            let ffaa = b01;
            // filter here, e.g. uniqueness
            let flowData = 
              (flows.U_alias.enabled && (b0_fs_n == 1))
              ? pathsUnique : put ;
            if (b0_fs_n)
            {
              flowData.push.apply(flowData, ffaa);
            }
            if (trace_path > 1)
            {
              console.log(put.length, pathsUnique.length, "b0_fs_n", b0_fs_n, /*b0,*/ f0 , f1 , ffaa.length);
              log_ffaa(ffaa[0]);
            }
          });
        });
    });
  };
  d3.keys(adjAxes).forEach(selectCurrentAdjPaths);
  if (trace_adj > 1)
    console.log("filterPaths", put.length, pathsUnique.length);
}

//-collate or gd
/**
 * compile map of feature -> array of Axes
 *  array of { stack{Axes...} ... }
 * stacks change, but Axes/chromosomes are changed only when page refresh
 */
function collateFeatureMap()
{
  console.log("collateFeatureMap()");
  let
    featureToAxis = flowsService.featureToAxis,
  featureAliasToAxis = flowsService.featureAliasToAxis;
  let oa = oa_();
  let z = oa.z;
  for (let axis in z)
  {
    for (let feature in z[axis])
    {
      // console.log(axis, feature);
      if (featureToAxis[feature] === undefined)
        featureToAxis[feature] = [];
      featureToAxis[feature].push(axis);
    }
    /* use feature aliases to match makers */
    Object.entries(z[axis]).forEach
    (
      /** feature is the feature name, f is the feature object in z[].  */
      function ([feature, f])
      {
        /** f.aliases is undefined for z entries created via an alias. */
        let a = f.aliases;
        // console.log(feature, a);
        if (a)
          for (let ai=0; ai < a.length; ai++)
        {
            let alias = a[ai];
            // use an arbitrary order (feature name), to reduce duplicate paths
            if (alias < feature)
            {
              featureAliasToAxis[alias] || (featureAliasToAxis[alias] = []);
              featureAliasToAxis[alias].push(axis);
            }
          }
      }
    );
  }
}

//-stacks derived
/** given 2 arrays of feature names, concat them and remove duplicates */
function concatAndUnique(a, b)
{
  let c = a || [];
  if (b) c = c.concat(b);
  let cu = [...new Set(c)];
  return cu;
}
//-stacks data / collate
/** Return an array of Axes contain Feature `feature` and are in stack `stackIndex`.
 * @param feature  name of feature
 * @param stackIndex  index into stacks[]
 * @return array of Axes
 */
function featureStackAxes(feature, stackIndex)
{
  let oa = oa_();
  let
    featureToAxis = flowsService.featureToAxis,
  featureAliasToAxis = flowsService.featureAliasToAxis;
  /** sfi are the Axes selected by feature. */
  let stack = oa.stacks[stackIndex], sfi=concatAndUnique(featureAliasToAxis[feature], featureToAxis[feature]);
  // console.log("featureStackAxes()", feature, stackIndex, sfi);
  let fAxis_s  = sfi.filter(function (axisID) {
    let mInS = stack.contains(axisID); return mInS; });
  // console.log(fAxis_s );
  return fAxis_s ;
}


/*----------------------------------------------------------------------------*/

/**
 * change to use feature alias group as data of path;
 *  for non-aliased features, data remains as feature - unchanged
 * 
 * when stack adjacency changes (i.e. drop in/out, dragended) :
 * 
 * compile a list, indexed by feature names,
 *   array of
 *     axis from / to (optional : stack index from / to)
 * 
 * compile a list, indexed by feature alias group names (catenation of aliased feature names),
 *   feature name
 *   array of
 *     axis from / to (optional : stack index from / to)
 * 
 * I think these will use 2 variants of featureStackAxes() : one using featureToAxis[] and the other featureAliasToAxis[].
 * Thinking about what the hover text should be for paths drawn due to an alias - the alias group (all names), or maybe the 2 actual features.
 * that is why I think I'll need 2 variants.
 * 
 * path()
 *   based on the current path(), retain the part inside the 3rd nested for();
 *   the remainder (outer part) is used to as the basis of the above 2 collations.
 * 
 * More detail in collateData() and collateStacks().
 */

/** Replaced by collateStacks(). */
function collateMagm(d) // d is featureName
{
  let oa = oa_();
  let featureAliasGroupAxes = flowsService.featureAliasGroupAxes;
  /* This method originated in path(featureName), i.e. it starts from a given featureName;
   * in next version this can be re-written to walk through :
   *  all adjacent pairs of stacks  :
   *   all Axes of those stacks :
   *    all features of those Axes
   */
  for (let stackIndex=0; stackIndex<oa.stacks.length-1; stackIndex++) {
    let fAxis_s0 = featureStackAxes(d, stackIndex),
    fAxis_s1 = featureStackAxes(d, stackIndex+1);
    // Cross-product of the two adjacent stacks; just the Axes which contain the feature.
    for (let a0i=0; a0i < fAxis_s0.length; a0i++) {
      let a0 = fAxis_s0[a0i];
      for (let a1i=0; a1i < fAxis_s1.length; a1i++) {
        let a1 = fAxis_s1[a1i];
        if (featureAliasGroupAxes[d] === undefined)
          featureAliasGroupAxes[d] = [];
        featureAliasGroupAxes[d].push([stackIndex, a0, a1]);
      }
    }
  }
}


/*----------------------------------------------------------------------------*/

export {
  flowsServiceInject,
  collateStacks, countPaths, countPathsWithData,
  collateData, collateFeatureClasses, maInMaAG, collateStacks1,
  pathsUnique_log, log_maamm, log_ffaa, mmaa2text,
  getAliased, collateStacksA, objPut,
  aliasesText, aliasText,
  addPathsToCollation, addPathsByReferenceToCollation,
  storePath, filterPaths,
  collateFeatureMap, concatAndUnique, featureStackAxes,
  collateMagm
};
