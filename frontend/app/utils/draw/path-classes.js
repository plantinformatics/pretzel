import $ from 'jquery';

import createIntervalTree from 'interval-tree-1d';

//------------------------------------------------------------------------------

/* global d3 */

//------------------------------------------------------------------------------

import { I } from './d3-svg';

import { collateFeatureClasses } from './collate-paths';

import {
  AxisChrName,
  makeIntervalName,
} from '../utility-chromosome';

import { showTickLocations } from './feature-info';
import { PathDataUtils } from './path-data';

import {
  axisId2Name,
} from '../stacks';

import { showSynteny } from './synteny-blocks-draw';
import { logSelection } from '../log-selection';

//------------------------------------------------------------------------------


const trace = 0;
const trace_synteny = 1;
const trace_path_colour = 0;


const dLog = console.debug;

//------------------------------------------------------------------------------

/** default colour for paths; copied from app.css (.foreground path {
 * stroke: #808;}) so it can be returned from d3 stroke function.  Also
 * used currently to recognise features which are in colouredFeatures via
 * path_colour_scale(), which is a useful interim measure until scales are
 * set up for stroke-width of colouredFeatures, or better a class.
 */
let pathColourDefault = "#808";


/** Apply colours to the paths according to their feature name (datum); repeating ordinal scale.
 * meaning of values :
 *  set path_colour_domain to
 *   1 : features
 *   2 : Object.keys(aliasGroup)
 *  colour according to input from colouredFeatures; just the listed featureNames is coloured :
 *  each line of featureNames is         domain is
 *   3: featureName                      featureName-s
 *   4: scaffoldName\tfeatureName        scaffoldName-s
 *      scaffoldName can be generalised as class name.
 */
let use_path_colour_scale = 4;
let path_colour_scale_domain_set = false;

let path_colour_scale;

//------------------------------------------------------------------------------

let featureScaffold = {},
scaffolds = new Set(), scaffoldFeatures = {};
let intervals = {}, intervalNames = new Set(), intervalTree = {};
//-scaffolds
/** scaffoldTicks[axisID] is a set of y locations, relative to the y axis of axisID, of horizontal tick marks.
 * General purpose; first use is for scaffold edges.
 */
let scaffoldTicks = {};

//------------------------------------------------------------------------------

/** for tracing changes to showScaffoldFeatures */
let showScaffoldFeaturesPrevious;

//------------------------------------------------------------------------------

//Add foreground lines.
/** pathData is the data of .foreground > g > g, not .foreground > g > g > path */

/** Determine class name of path or g, @see pathDataInG.
 * Value is currently just concatenation of names of endpoint features, could be aliasGroupName.
 * If Flow.direct then use I for pathClass, otherwise pathClassA()
 */
function pathClassA(d)
{ let d0=d[0], d1=d[1], c = d1 && (d1 != d0) ? d0 + "_" + d1: d0;
  return c; }


//------------------------------------------------------------------------------

/* Could make PathClasses into a service, but probably the state .scaffoldTicks
 * will move to e.g. services/data/transient.js.
 */

function PathClasses(oa) {

  const result = {
    scaffoldTicks,
    configurePathColour,
    // colouredFeaturesChanged,
    colouredAg,
    classFromSet,
    locationClasses,
    pathClasses,
    pathColourUpdate,
    scaffoldLegendColourUpdate,
  };

  //----------------------------------------------------------------------------

  function getViewOptions() {
    return oa.eventBus.get('flowsService.viewOptions');
  }

  //----------------------------------------------------------------------------

  function configurePathColour() {
    if (use_path_colour_scale)
    {
      let path_colour_domain;
      switch (use_path_colour_scale)
      {
      case 1 : path_colour_domain = oa.features; break;
      case 2 : path_colour_domain = Object.keys(oa.aliasGroup); break;
      default:
      case 4:
      case 3 : path_colour_domain = ["unused"];
        const me = oa.eventBus;
        me.set('colouredFeaturesChanged', colouredFeaturesChanged);
        break;
      }
      path_colour_scale = d3.scaleOrdinal();
      path_colour_scale_domain_set = (use_path_colour_scale !== 3) && (use_path_colour_scale !== 4);
      if (path_colour_scale_domain_set)
        path_colour_scale.domain(path_colour_domain);
      else
        path_colour_scale.unknown(pathColourDefault);
      path_colour_scale.range(d3.schemeCategory10);
    }

  }

  function colouredFeaturesChanged(colouredFeatures_) {
    const
    axisChrName = AxisChrName(oa),
    mapChr2Axis = oa.mapChr2Axis,
    syntenyBlocks = oa.syntenyBlocks;
    console.log('colouredFeatures changed, length : ', colouredFeatures_.length);
    let val;
    if ((colouredFeatures_.length !== 0) &&
        ((val = getUsePathColour()) !== undefined))
    {
      /** use_path_colour_scale manages the effect of the path colouring
       * date entered here; this doesn't allow the different modes
       * selected by use_path_colour_scale to co-exist effectively, but
       * scaffoldTicks is separate, so by distinguishing
       * input_path_colour_scale from use_path_colour_scale, it is
       * possible to use 6 with e.g. 4.
       * ditto 7.
       */
      let input_path_colour_scale = val;
      if ((val != 6) && (val != 7))
        use_path_colour_scale = val;

      /** depending on use_path_colour_scale === 3, 4 each line of featureNames is 
       * 3: featureName 
       * 4: scaffoldName\tfeatureName
       */
      let featureNames = colouredFeatures_
      // .split('\n');
      // .match(/\S+/g) || [];
        .match(/[^\r\n]+/g);
      path_colour_scale_domain_set = featureNames.length > 0;
      if (input_path_colour_scale === 3)
        path_colour_scale.domain(featureNames);
      else if (input_path_colour_scale === 4)
      {
        for (let i=0; i<featureNames.length; i++)
        {
          let
          col=featureNames[i].split(/[ \t]+/),
          scaffoldName = col[0], featureName = col[1];
          featureScaffold[featureName] = scaffoldName;
          // for the tooltip, maybe not required.
          if (scaffoldFeatures[scaffoldName] === undefined)
            scaffoldFeatures[scaffoldName] = [];
          scaffoldFeatures[scaffoldName].push(featureName);
          scaffolds.add(scaffoldName);
        }
        collateFeatureClasses(featureScaffold);
        const
        viewOptions = getViewOptions(),
        showScaffoldFeatures = viewOptions?.showScaffoldFeatures;
        if (showScaffoldFeatures !== showScaffoldFeaturesPrevious)
        {
          showScaffoldFeaturesPrevious = showScaffoldFeatures;
          console.log("showScaffoldFeatures", showScaffoldFeatures);
        }
        if (showScaffoldFeatures)
        {
          const me = oa.eventBus;
          me.set('scaffolds', scaffolds);
          me.set('scaffoldFeatures', scaffoldFeatures);
        }
        let domain = Array.from(scaffolds.keys());
        console.log("domain.length", domain.length);
        path_colour_scale.domain(domain);
      }
      else if (input_path_colour_scale === 5)
      {
        for (let i=0; i<featureNames.length; i++)
        {
          let
          col=featureNames[i].split(/[ \t]+/),
          mapChrName = col[0], interval = [col[1], col[2]];
          let axisName = axisChrName.mapChrName2Axis(mapChrName);
          if (intervals[axisName] === undefined)
            intervals[axisName] = [];
          intervals[axisName].push(interval);
          let intervalName = makeIntervalName(mapChrName, [col[1], + col[2]]);
          intervalNames.add(intervalName);
        }
        Object.keys(intervals).forEach(function (axisName) {
          //Build tree
          intervalTree[axisName] = createIntervalTree(intervals[axisName]);
        });

        // scaffolds and intervalNames operate in the same way - could be merged or factored.
        let domain = Array.from(intervalNames.keys());
        console.log("domain.length", domain.length);
        path_colour_scale.domain(domain);
      }
      else if (input_path_colour_scale === 6)
      {
        for (let i=0; i<featureNames.length; i++)
        {
          let
          col=featureNames[i].split(/[ \t]+/),
          mapChrName = col[0], tickLocation = col[1];
          let axisName = axisChrName.mapChrName2Axis(mapChrName);
          if (axisName === undefined)
            console.log("axis not found for :", featureNames[i], mapChr2Axis);
          else
          {
            if (scaffoldTicks[axisName] === undefined)
              scaffoldTicks[axisName] = new Set();
            scaffoldTicks[axisName].add(tickLocation);
          }
        }
        console.log(scaffoldTicks);
        showTickLocations(scaffoldTicks, undefined);
      }
      else if (input_path_colour_scale === 7)
      {
        for (let i=0; i<featureNames.length; i++)
        {
          let cols=featureNames[i].split(/[ \t]+/);
          let ok = true;
          for (let j=0; j < 2; j++)
          {
            /** Axes of syntenyBlock may not be loaded yet. */
            let mapChr2Axis = cols[j], axisName = axisChrName.mapChrName2Axis(mapChr2Axis);
            cols[j] = axisName;
            if (axisName === undefined)
              console.log("axis not found for :", featureNames[i], mapChr2Axis);
            for (let k = 0; k < 2; k++)
            {
              let f = cols[2 + 2*j + k];
              if (oa.z[axisName][f] === undefined)
              {
                console.log(f, "not in", axisName, axisId2Name(axisName));
                ok = false;
              }
            }
            ok &= axisName !== undefined;
          }
          if (ok)
          {
            syntenyBlocks.push(cols);
          }
        }
        if (trace_synteny)
          console.log(syntenyBlocks.length, syntenyBlocks);
        showSynteny(syntenyBlocks, undefined, oa);
      }
      else if (trace_path_colour > 2)
        console.log("use_path_colour_scale", use_path_colour_scale);

      pathColourUpdate(undefined, undefined);
      scaffoldLegendColourUpdate();
    }
  }

  //----------------------------------------------------------------------------

  function clearScaffoldColours() {
    console.log("clearScaffoldColours");
    featureScaffold = {}, scaffolds = new Set(), scaffoldFeatures = {};
    const
    flowsService = oa.eventBus.flowsService;
    flowsService.aliasGroupClasses = {};
    pathColourUpdate(undefined, undefined);
  }

  //----------------------------------------------------------------------------

  function getUsePathColour()
  {
    let inputParent = '#choose_path_colour_scale',
    inputs = $(inputParent + ' input'), val;
    for (let ii = 0;
         (ii < inputs.length) && (val === undefined);
         ii++)
    {
      if (inputs[ii].checked)
      {
        val = inputs[ii].getAttribute("data-value"); // .value;
        val = parseInt(val);
      }
    }
    console.log(inputParent + " value", val);
    return val;
  }

  //----------------------------------------------------------------------------

  /** If featureName has an alias group with a feature with an assigned class (colour) then return the classes.
   * @return undefined otherwise
   */
  function colouredAg(axisName, featureName)
  {
    let classSet,
    feature = oa.z[axisName][featureName], //  || oa.featureIndex[featureName],  // use featureIndex[] if featureName was ID, but instead have converted IDs -> names.
    aliasGroupName = feature.aliasGroupName;
    if (aliasGroupName)
    {
      const
      flowsService = oa.eventBus.flowsService,
      aliasGroupClasses = flowsService.aliasGroupClasses;
      classSet = aliasGroupClasses[aliasGroupName];
    }
    return classSet;
  }
  function classFromSet(classSet)
  {
    /** can use any element of set; later may cycle through them with slider. */
    let colourOrdinal = classSet.values().next().value;
    return colourOrdinal;
  }
  /** @param axisName could be chrName : feature name is looked up via axisName,
   * but intervals might be defined in terms of chrName; which is currently
   * the same thing, but potentially 1 chr could be presented by multiple axes.
   * see axisName2Chr();
   * @return name of interval, as per makeIntervalName()
   * Later maybe multiple results if intervals overlap.
   */
  function locationClasses(axisName, featureName)
  {
    let classes,
    f = oa.z[axisName][featureName],
    location = f.location,
    axisChrName = AxisChrName(oa),
    chrName = axisChrName.axisName2Chr(axisName),
    mapChrName = axisId2Name(axisName) + ":" + chrName,
    it = intervalTree[axisName];

    if (it)
      //Find all intervals containing query point
      it.queryPoint(location, function(interval) {
        /* later return Set or array of classes.  */
        classes = makeIntervalName(mapChrName, interval);
        if (trace_path_colour > 2)
          console.log("locationClasses", "axisName", axisName, "mapChrName", mapChrName, "featureName", featureName, ", scaffold/class", classes);
      });

    return classes;  
  }
  /** Access featureName/s from d or __data__ of parent g of path.
   * Currently only used when (use_path_colour_scale === 4), but aims to be more general.
   * Lookup featureScaffold to find class, or if (use_path_colour_scale === 4)
   * also look up colouredAg().  @see use_path_colour_scale

   * The scaffold of a feature was the first use; this has been generalised to a "class";
   * i.e. feature names are mapped (via colouredFeatures) to class names.
   * This function is used by stroke (todo) and class functions of path.
   * (based on a blend & update of those 2, mostly a copy of stroke).
   * @param pathElt <path> element which is to be coloured / classed
   * @param d datum of pathElt
   */
  function pathClasses(pathElt, d)
  {
    const pathDataUtils = PathDataUtils(oa);
    let classes;
    /** d is path SVG line text if pathDataIsLine */
    let da = pathDataUtils.dataOfPath(pathElt);
    /** similar to : (da.length === 4) or unique_1_1_mapping */
    let dataIsMmaa = typeof(da) === "object";
    let featureName = dataIsMmaa ? da[0] : da, // also @see featureNameOfPath(pathElt)
    colourOrdinal;
    if (use_path_colour_scale < 4)
    {
      colourOrdinal = featureName;
    }
    else if ((use_path_colour_scale === 4) && featureScaffold)
    {
      colourOrdinal = featureScaffold[featureName];
      /* colour the path if either end has a class mapping defined.
       * if d[0] does not then check d[1].
       */
      if ((colourOrdinal === undefined) && dataIsMmaa
          && (da[0] != da[1]))
      {
        colourOrdinal = /*featureScaffold[da[0]] ||*/ featureScaffold[da[1]];
      }
      if (trace_path_colour > 2)
        console.log("featureName", featureName, ", scaffold/class", colourOrdinal);
    }
    else if (use_path_colour_scale === 5)
    {
      // currently, result of locationClasses() is a string identifying the interval,
      // and matching the domain value.
      if (dataIsMmaa)
      {
        classes = locationClasses(da[2].axisName, featureName)
          || locationClasses(da[3].axisName, da[1]);
      }
      else
      {
        let Axes = oa.featureAxisSets[featureName], axisName;
        // choose the first chromosome;  may be unique.
        // if not unique, could colour by the intervals on any of the Axes,
        // but want just the Axes which are points on this path.
        for (axisName of Axes) { break; }
        classes = locationClasses(axisName, featureName);
      }
    }
    if (classes !== undefined)
    {
    }
    else if (colourOrdinal)
      classes = colourOrdinal;
    else if (dataIsMmaa)
    {
      /* Like stroke function above, after direct lookup of path end
       * features in featureScaffold finds no class defined, lookup via
       * aliases of end features - transitive.
       */
      /* if ! dataIsMmaa then have featureName but no Axes; is result of a direct flow,
       * so colouring by AliasGroup may not be useful.
       */
      // collateStacks() / maInMaAG() could record in pathsUnique the alias group of the path.
      let
      /** based on similar in handleMouseOver(). */
        featureNames, blockIds;
        if (Array.isArray(da)) {
          const [feature0, feature1, a0, a1] = da;
          featureNames = [feature0, feature1];
          blockIds = [a0.axisName, a1.axisName];
        } else {
          featureNames = da.alignment.mapBy('repeats.features.0.name');
          blockIds = da.alignment.mapBy('blockId');
        }
      const
      classSet =
        colouredAg(blockIds[0], featureNames[0]) ||
        colouredAg(blockIds[1], featureNames[1]);
      classes = classSet;
    }
    return classes;
  }
  function pathColourUpdate(gd, flow)
  {
    const pathDataUtils = PathDataUtils(oa);
    if (trace_path_colour)
    {
      console.log
      ("pathColourUpdate", flow && flow.name, flow,
       use_path_colour_scale, path_colour_scale_domain_set, path_colour_scale.domain());
      if (gd && (trace_path_colour > 2))
        logSelection(gd);
    }
    let flowSelector = flow ? "." + flow.name : "";
    if (gd === undefined)
      gd = d3.selectAll(".foreground > g" + flowSelector + "> g").selectAll("path");

    if (use_path_colour_scale && path_colour_scale_domain_set)
      if (use_path_colour_scale >= 4)
        gd.style('stroke', function(d) {
          let colour;
          /** d is path SVG line text if pathDataIsLine */
          let da = pathDataUtils.dataOfPath(this);
          /** similar to : (da.length === 4) or unique_1_1_mapping */
          let dataIsMmaa = typeof(da) === "object";
          let featureName = dataIsMmaa ? da[0] : da, // also @see featureNameOfPath(this)
          colourOrdinal = featureName;
          if ((use_path_colour_scale === 4) && featureScaffold)
          {
            colourOrdinal = featureScaffold[featureName];
            /* colour the path if either end has a class mapping defined.
             * if d[0] does not then check d[1].
             */
            if ((colourOrdinal === undefined) && dataIsMmaa
                && (da[0] != da[1]))
            {
              colourOrdinal = featureScaffold[da[0]] || featureScaffold[da[1]];
            }
          }
          else if (use_path_colour_scale === 5)
          {
            let classSet = pathClasses(this, d);
            colourOrdinal = (classSet === undefined) ||
              (typeof classSet == "string")
              ? classSet : classFromSet(classSet);
          }
          // path_colour_scale(undefined) maps to pathColourDefault
          if ((colourOrdinal === undefined) && dataIsMmaa)
          {
            /* if ! dataIsMmaa then have featureName but no Axes; is result of a direct flow,
             * so colouring by AliasGroup may not be useful.
             */
            // collateStacks() / maInMaAG() could record in pathsUnique the alias group of the path.
            let [feature0, feature1, a0, a1] = da;
            let classSet = colouredAg(a0.axisName, feature0) || colouredAg(a1.axisName, feature1);
            if (classSet)
              colourOrdinal = classFromSet(classSet);
            if (false && colourOrdinal)
              console.log(featureName, da, "colourOrdinal", colourOrdinal);
          }
          if (colourOrdinal === undefined)
            colour = undefined;
          else
            colour = path_colour_scale(colourOrdinal);

          if (false && (colour !== pathColourDefault))  // change false to enable trace
            console.log("stroke", featureName, colourOrdinal, colour);
          return colour;
        });

    if (use_path_colour_scale === 3)
      gd.classed("reSelected", function(d, i, g) {
        /** d is path SVG line text */
        let da = pathDataUtils.dataOfPath(this);
        let dataIsMmaa = typeof(da) === "object";
        let featureName = dataIsMmaa ? da[0] : da;

        let pathColour = path_colour_scale(featureName);

        // console.log(featureName, pathColour, d, i, g);
        let isReSelected = pathColour !== pathColourDefault;
        return isReSelected;
      });

    if (use_path_colour_scale >= 4)
      gd.attr("class", function(d) {
        let scaffold, c,
        classes = pathClasses(this, d),
        simpleClass;
        if ((simpleClass = ((typeof(classes) != "object"))))
        {
          scaffold = classes;
        }
        else  // classes is a Set
        {
          let classSet = classes;
          scaffold = "";
          for (let cl of classSet)
          {
            scaffold += " " + cl;
          }
          // console.log("class", da, classSet, scaffold);
        }

        if (scaffold)
        {
          c = (simpleClass ? "" : "strong" + " ") + scaffold;
          if (trace_path_colour > 2)
            console.log("class", scaffold, c, d, this);
        }
        else if (false)
        {
          console.log("class", this, pathDataUtils.featureNameOfPath(this), featureScaffold, scaffold, c, d);
        }

        return c;
      });
  }

  function scaffoldLegendColourUpdate()
  {
    console.log("scaffoldLegendColourUpdate", use_path_colour_scale);
    if (use_path_colour_scale === 4)
    {
      let da = Array.from(scaffolds),
      ul = d3.select("div#scaffoldLegend > ul");
      // console.log(ul, scaffolds, da);
      let li_ = ul.selectAll("li")
        .data(da);
      // console.log(li_);
      let la = li_.enter().append("li");
      // console.log(la);
      let li = la.merge(li_);
      li.html(I);
      li.style("color", function(d) {
        // console.log("color", d);
        let scaffoldName = d,
        colourOrdinal = scaffoldName;
        let colour = path_colour_scale(colourOrdinal);

        if (false && (colour != pathColourDefault)) // change false to enable trace
        {
          console.log("color", scaffoldName, colour, d);
        }
        return colour;
      });
    }
  }

  return result;
}

//------------------------------------------------------------------------------

export {
  pathClassA,
  PathClasses,
};

