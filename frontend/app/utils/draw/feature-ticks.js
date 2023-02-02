import { contentOf } from '../../utils/common/promises';


import {
  stacks,
} from '../../utils/stacks';
import {
  axisEltIdClipPath,
  axisTitleColour,
} from '../../utils/draw/axis';
import { selectAxis } from '../../utils/draw/stacksAxes';
import { nowOrAfterTransition } from '../../utils/draw/d3-svg';
import { configureHover } from '../../utils/hover';
import { getAttrOrCP } from '../../utils/ember-devel';


/* global d3 */

//------------------------------------------------------------------------------

const trace_stack = 0;

const dLog = console.debug;

//------------------------------------------------------------------------------

/* showTickLocations() and configureHover() are based on the
 * corresponding functions in draw-map.js
 * There is a lot of variation at all levels between this application and the
 * original - draft factoring (axisDomData.js) showed a blow-out of abstraction
 * and complexity even before all the differences were handled.
 */

const className = "horizTick";
const FeatureTick_className = className;

//------------------------------------------------------------------------------

/** filter : @return true if the given Block is configured to display ticks.
 *
 * Previously : ! block.block.get('dataset').get('showPaths') to select
 * the scaffolds, but that is no longer relevant since ticks are no
 * longer used for scaffolds.  So now return block ... .isData
 */
function blockWithTicks(block)
{
  let isData = block.block.get('isData');  // was .showPaths
  // dLog('blockWithTicks', block.axisName, showPaths);
  return isData;
}

/** Return a filter to select features which are within the current zoomedDomain
 * of the given block.
 * @param block stacks Block
 */
function inRangeBlock(range0, block) {
  return function (feature) {
    let
    axis1d = block.axis;
    return axis1d.inRangeR(feature, range0);
  };
}

//------------------------------------------------------------------------------

/** Draw horizontal ticks on the axes, at feature locations.
 * This is used for 2 cases so far :
 * . all features of blocks which have !showPaths, when axis is ! extended
 * . features found in blocks using feature search (goto-feature-list)
 *
 * @param axis  Stacked
 * @param axisApi for lineHoriz
 * @param axis1d axis-1d component, to lookup axisObj.extended
 */
function FeatureTicks(axis, axisApi, axis1d)
{
  this.axis = axis;
  this.axisApi = axisApi;
  this.axis1d = axis1d;

  this.getTransitionTime = () => this.axis1d.get('transitionTime');
  this.selectionToTransition = (selection) => this.axis1d.selectionToTransition(selection);
  this.featureY = (feature) => this.axis1d.featureY(feature);
  this.blockColourValue = (feature) => this.axis1d.blockColourValue(feature);
  this.selectGroup = (groupName) => this.axis1d.selectGroup(groupName);
}

/** @return a function to lookup from block to an array of features.
 * Used as a d3 .data() function with block as data.
 */
FeatureTicks.prototype.featuresOfBlock = function (featuresOfBlockLookup) {
  let
  range0 = this.axis.yRange2();

    return (block) => {
      let inRange = inRangeBlock(range0, block);

      let blockR = block.block,
      blockId = blockR.get('id'),
      featuresAll = featuresOfBlockLookup(blockR),
      features = ! featuresAll ? [] : featuresAll
        .filter(inRange);
      if (trace_stack > 1) {
        dLog(blockId, features.length, 'showTickLocations featuresOfBlock');
      }
      return features;
    };
};

/** Determine the colour for the feature, either traitColour() if
 * feature.blockId is a QTL, or otherwise blockColourValue().
 */
FeatureTicks.prototype.featureColour = function (feature) {
  /** Similar @see featurePathStroke() */
  let colour;
  let block = feature.get('blockId');
  let qtlColourBy = block.get('useFeatureColour');
  if (qtlColourBy) {
    colour = feature.colour(qtlColourBy);
  } else {
    colour = this.blockColourValue(contentOf(block));
  }
  return colour;
};

function blockTickEltId(groupName) {
  return function (block) { return className + '_' + groupName + '_' + block.axisName; };
}


/** Draw horizontal ticks on the axes, at feature locations.
 *
 * @param featuresOfBlockLookup map from block to array of features; its param is :
 * @param axis  block (Ember object), result of stacks-view:axesP
 * If the axis has multiple (data) blocks, this is the reference block.
 */
FeatureTicks.prototype.showTickLocations = function (featuresOfBlockLookup, setupHover, groupName, blockFilter, clickFn)
{
  /** Called from axis-ticks-selected : renderTicks(), and originally also
   * called from axis-1d : renderTicks() to represent the edges of scaffolds.
 */
  let axis = this.axis, axisApi = this.axisApi;
  let axisName = axis.axisName;
  let
    axisObj = this.axis1d.get('axisObj'),
  // The following call to this.axis1d.get('extended')
  // replaces directly accessing axisObj.extended
  extended = this.axis1d.get('extended');
  if (trace_stack)
    dLog('showTickLocations', extended, axisObj, groupName);

  let blockIndex = {};
  let aS = selectAxis(axis);
  if (!aS.empty())
  {
    /** show no ticks if axis is extended. */
    const notWhenExtended = false;
    let blocks = (notWhenExtended && extended ? [] : blockFilter ? axis.blocks.filter(blockWithTicks) : axis.blocks);
    let gSA = this.selectGroup(groupName);
    if (!gSA.empty()) {

      function storeBlockIndex (block, i) {
        blockIndex[block.getId()] = i;
        if (trace_stack)
          dLog('blockIndex', block.getId(), i);
      };

      /** data blocks of the axis, for calculating blockIndex i.e. colour.
       * colour assignment includes non-visible blocks . */
      let blocksUnfiltered = extended ? [] : axis.dataBlockViewsFiltered(false, false);
      if (trace_stack)
        dLog('blockIndex', axisName, axis, axis.blocks);
      blocksUnfiltered.forEach(storeBlockIndex);

      featuresOfBlockLookup ||= function (blockR) {
        return blockR.get('features').toArray();
      };
      let featuresOfBlock = this.featuresOfBlock(featuresOfBlockLookup);

      let
      pS = gSA
        .selectAll("path." + className)
        .data(featuresOfBlock, keyFn),
      pSE = pS.enter()
        .append("path")
        .attr("class", className)
      ;

      /** @return rgb() colour for feature <path> stroke (feature ticks / triangles)
       * @desc Calling signature : `this` is the DOM element to be coloured,  from d3 .attr() `this`
       */
      function featurePathStroke (feature, i2) {
        /** Similar : FeatureTicks.prototype.featureColour() */
        let colour;
        /** BlockAxisView / block-axis-view (was Stacks : Block) */
        let block = this.parentElement.__data__;
        let qtlColourBy = block.block.get('useFeatureColour');
        if (qtlColourBy) {
          colour = feature.colour(qtlColourBy);
        } else {
          let
          blockId = block.getId(),
          /** Add 1 to i because it is the elt index, not the
           * index within axis.blocks[], i.e. the reference block is not included. */
          i = blockIndex[blockId];
          if (i2 < 2)
            dLog(this, 'stroke', blockId, i);
          colour = axisTitleColour(block, i+1) || 'black';
        }
        return colour;
      }

      if (setupHover === true)
      {
        setupHover = 
          function setupHover (feature) 
        {
          let block = this.parentElement.__data__;
          return configureHover.apply(this, [{feature, block}, hoverTextFn]);
        };

        pSE
          .each(setupHover);
      }
      pSE.on('click', clickFn);

      pS.exit()
        .remove();
      /** Instead of using .merge(), show .enter() elements (at their
       * final posiiton) after the pS elements have transitioned to
       * their final position.
       let pSM = pSE.merge(pS);
      */

      /* update attr d in a transition if one was given.  */
      let p1 = // (t === undefined) ? pSM :
          this.selectionToTransition(pS);

      /** similar comment re. transitionTime as in showLabels() */
      nowOrAfterTransition(
        p1, () => pSE.call(pathAndColour),
        this.axis1d.transitionTime);

      p1.call(pathAndColour);
      function pathAndColour(selection) {
        selection
        .attr("d", pathFn)
        .attr('stroke', featurePathStroke)
        .attr('fill', featurePathStroke)
      ;
      }

    }
  }

  function keyFn (feature) {
    // here `this` is the parent of the <path>-s, e.g. g.axis

    /** If feature is the result of block.get('features') then it will be an
     * ember store object, but if it is the result of featureSearch() then it will be
     * just the data attributes, and will not implement .get().
     * Using feature.name instead of feature.get('name') will work in later
     * versions of Ember, and will work after the computed property is
     * evaluated, because name attribute does not change.
     * The function getAttrOrCP() will use .get if defined, otherwise .name (via ['name']).
     * This comment applies to use of 'feature.'{name,range,value} in
     * inRange() (above), and keyFn(), pathFn(), hoverTextFn() below.
     *
     * The features created from blast search results will all have the same name,
     * so for better d3 join, append location to the key.
     */
    let
    value = getAttrOrCP(feature, 'value'),
    featureName = getAttrOrCP(feature, 'name') + '-' + value[0];
    // dLog('keyFn', feature, featureName); 
    return featureName;
  };
  function pathFn (feature) {
    // based on axisFeatureTick(ai, d)
    /** shiftRight moves right end of tick out of axis zone, so it can
     * receive hover events.
     */
    let xOffset = 25, shiftRight=5;
    /* the requirements for foundFeatures path will likely evolve after trial,
     * so this informal customisation is sufficient until the requirements are
     * settled.
     */
    if (groupName === 'foundFeatures') {
      xOffset = 35;
    }
    let ak = axisName,
    range = getAttrOrCP(feature, 'range') || getAttrOrCP(feature, 'value'),
    tickY = range && (range.length ? range[0] : range),
    // sLine = axisApi.lineHoriz(ak, tickY, xOffset, shiftRight);
    // instead of lineHoriz(), use horizTrianglePath().
    /** scaled to axis.
     * could instead use featureY_(ak, feature.id);     */
    axis1d = feature.get('blockId.axis1d'),
    akYs = axis1d.y(tickY),
    sLine = horizTrianglePath(akYs, 10, xOffset / 2, 1);
    return sLine;
  };

  /** Construct a <path> which draws a horizontal isosceles triangle, pointing right.
   * This is used to indicate on an axis the position of features search results.
   * @param akYs	scaled y position of feature
   * @param yLength	length of triangle base
   * @param xLength	length of triangle x axis
   * @param shiftLeft	offset of vertex from y axis
   */
  function horizTrianglePath(akYs, yLength, xLength, shiftLeft) {
    /** related : axisApi.lineHoriz(), featureLineS()  */
    let
    baseX = -xLength + shiftLeft,
    y2 = yLength / 2;
    let path = d3.line()(
      [[baseX, akYs - y2],
       [-shiftLeft, akYs],
       [baseX, akYs + y2]]) + 'Z';
    return path;
  };

  /** eg: "scaffold23432:1A:1-534243" */
  function hoverTextFn(context) {
    let {feature, block} = context;
    let
      /** value is now renamed to range, this handles some older data. */
      range = getAttrOrCP(feature, 'range') || getAttrOrCP(feature, 'value'),
    rangeText = range && (range.length ? ('' + range[0] + ' - ' + range[1]) : range),
    blockR = block.block,
    featureName = getAttrOrCP(feature, 'name'),
    scope = blockR && blockR.get('scope'),
    text = [featureName, scope, rangeText]
      .filter(function (x) { return x; })
      .join(" : ");
    return text;
  };
  // the code corresponding to hoverTextFn in the original is :
  // (location == "string") ? location :  "" + location;

};

/**
 * Specification : #223.  
 * 3.     Shift+ left click triangles on an axis draws a line across the top of the outermost triangles
 *   a.  determine extent of clicked features
 *   b. draw path across extent, near the base of the triangles
 */
FeatureTicks.prototype.showSpanningLine = function (featuresOfBlockLookup) {
  const groupName = 'spanFeatures';

  let axis = this.axis, axisApi = this.axisApi;
  let axisName = axis.axisName;

  let aS = selectAxis(axis);
  if (!aS.empty())
  {

    // .filter((b) => axis1d.selected.shiftClickedFeaturesByBlock(block.block)

    let gSA = this.selectGroup(groupName);
    /* selection / element data is BlockAxisView. */
    gSA
      .attr("clip-path", (blockView) => "url(#" + axisEltIdClipPath(blockView.axis) + ")");

    if (!gSA.empty()) {

      const spanFeaturesOfBlock = (blockS) => {
        let
        blockR = blockS.block,
        features = featuresOfBlockLookup(blockR),
        outermostFeatures = features && features
          .reduce((result, f) => {
            let y = this.featureY(f);
            if (! result[0] || (y < result.minY)) {
              result[0] = f;
              result.minY = y;
            }
            if (! result[1] || (y > result.maxY)) {
              result[1] = f;
              result.maxY = y;
            }
            return result; }, []);
        // .minY and .maxY are used in spanPathFn(), but could be deleted here and re-calculated.
        return outermostFeatures ? [outermostFeatures] : [];
      };

      const tagName = 'path';

      let
      pS = gSA
        .selectAll(tagName + "." + className)
        .data(spanFeaturesOfBlock /*, keyFn*/),
      pSE = pS.enter()
        .append(tagName)
        .attr("class", className)
      ;

      pS.exit()
        .remove();
      let pSM = pSE.merge(pS);

      const pathFn = (d,i,g) => this.spanPathFn(d,i,g);
      pSE
        .attr("d", pathFn)

      this.selectionToTransition(pSM)
        .attr("d", pathFn)
        .attr('stroke', (limitFeatures) => this.featureColour(limitFeatures[0]))
      ;

    }
  }
}

/** Construct a <path> which draws a line slightly left of the bases of the
 * triangles which represent the given outermost limitFeatures
 */
FeatureTicks.prototype.spanPathFn = function (limitFeatures) {
  // based on showTickLocations():pathFn(), horizTrianglePath(); related : axisFeatureTick(ai, d)

  /** features y extent / interval scaled to px. */
  let 
  /** only called if there is >=1 feature, so .minY and .maxY are defined.
   * equivalent to : limitFeatures.map((f) => this.featureY(featureY));
   */
  yIntS = [limitFeatures.minY, limitFeatures.maxY],
  padding = 0;
  if (yIntS[0] === yIntS[1]) {
    /** @param yLength	length of triangle base */
    const yLength = 10,
    y2 = yLength / 2;
    /** if padding is to be added when !==, use Math.sign(yIntS[1] - yIntS[0]) * y2 */
    padding = yLength;
  }

  /**
   * @param yLength	length of triangle base
   * @param xLength	length of triangle x axis
   * @param shiftLeft	offset of line from base of triangles
   */
  const xLength = 35 / 2;
  const shiftLeft = -1.5;

  let
  baseX = -xLength - shiftLeft;
  let path = d3.line()(
    [[baseX, yIntS[0] - padding],
     [baseX, yIntS[1] + padding]]);

  return path;
};



/** Draw text feature labels left of the axes, at location of features selected
 * by clicking on the feature triangle, recorded in selected.labelledFeatures.
 *
 */
FeatureTicks.prototype.showLabels = function (featuresOfBlockLookup, setupHover, groupName, blockFilter, transitionFn)
{

  function textFn(feature) {
    let
    featureName = getAttrOrCP(feature, 'name');
    return featureName;
  }

  // copied from .showTickLocations(); can probably factor the keyFn and <g> setup

  function keyFn (feature) {
    // here `this` is the parent of the <path>-s, e.g. g.axis
    let
    value = getAttrOrCP(feature, 'value'),
    featureName = getAttrOrCP(feature, 'name') + '-' + value[0];
    // dLog('keyFn', feature, featureName); 
    return featureName;
  };

  let axis = this.axis, axisApi = this.axisApi;
  let axisName = axis.axisName;

  let aS = selectAxis(axis);
  if (!aS.empty())
  {
    let gSA = this.selectGroup(groupName);
    if (!gSA.empty()) {

      let featuresOfBlock = this.featuresOfBlock(featuresOfBlockLookup);

      const tagName = 'text';
      /**  p* (i.e. pS, pSE, pSM, p1) are selections of the <path> in .showTickLocations or <text> in .showLabels
       * S : the whole selection, SE : the .enter().append(), SM : the SE merged back with S, 1 : SM with a transition.
       */
      let
      pS = gSA
        .selectAll(tagName + "." + className)
        .data(featuresOfBlock, keyFn),
      pSE = pS.enter()
        .append(tagName)
        .attr("class", className)
        .attr('stroke', this.featureColour.bind(this))
      ;

      /* pSE
         .each(setupHover); */

      pS.exit()
        .remove();
      let pSM = pSE.merge(pS);

      /** For <text> the d is constant, so use pSE.
       * For showTickLocations / <path>, the d updates, so pSM is used
       */
      pSE
      // positioned just left of the base of the triangles.  inherits text-anchor from axis;
        .attr('x', '-30px');

      let attrY_featureY = this.attrY_featureY.bind(this);

      let transition = this.selectionToTransition(pS);
      /** pass in the delay time, because transition has no duration if empty(). */
      nowOrAfterTransition(
        transition, () => {
          return pSE.call(attrY_featureY)
        .text(textFn);
        },
        this.axis1d.transitionTime);

      if (transition === pS) {
        pS.call(attrY_featureY);
      } else {
        transition.call(attrY_featureY);
        // transitionFn(transition, attrY_featureY);
      }
    }
  }

};

FeatureTicks.prototype.attrY_featureY = function(selection) {
  console.log('attrY_featureY', selection.node(), this.axis1d.zoomedDomain);
  selection
    .attr('y',  (feature) => this.axis1d.featureY(feature));
};

//------------------------------------------------------------------------------

export { FeatureTicks, FeatureTick_className, blockTickEltId };

//------------------------------------------------------------------------------
