import Ember from 'ember';
const { inject: { service } } = Ember;


import { sum } from 'lodash/math';
import { isEqual } from 'lodash/lang';


import AxisEvents from '../../utils/draw/axis-events';
import AxisPosition from '../../mixins/axis-position';
import { /* Block,*/ Stacked, /*Stack,*/ stacks /*, xScaleExtend, axisRedrawText, axisId2Name*/ } from '../../utils/stacks';
import {  noDomain, /* Axes, yAxisTextScale,  yAxisTicksScale,  yAxisBtnScale, yAxisTitleTransform, eltId,*/ axisEltId /*, eltIdAll, highlightId*/ , axisTitleColour  }  from '../../utils/draw/axis';
import {DragTransition, dragTransitionTime, dragTransitionNew, dragTransition } from '../../utils/stacks-drag';
import { selectAxis } from '../../utils/draw/stacksAxes';
import { breakPoint } from '../../utils/breakPoint';
import { configureHorizTickHover } from '../../utils/hover';
import { getAttrOrCP } from '../../utils/ember-devel';
import { intervalExtent }  from '../../utils/interval-calcs';
import { updateDomain } from '../../utils/stacksLayout';



/* global d3 */
/* global require */

/*------------------------------------------------------------------------*/

const trace_stack = 0;

const dLog = console.debug;

/* milliseconds duration of transitions in which axis ticks are drawn / changed.
 * Match with time used by draw-map.js : zoom() and resetZoom() : 750.
 * also @see   dragTransitionTime.
 */
const axisTickTransitionTime = 750;



function blockKeyFn(block) { return block.axisName; }


/*------------------------------------------------------------------------*/


/*------------------------------------------------------------------------*/


/* showTickLocations() and configureHorizTickHover() are based on the
 * corresponding functions in draw-map.js
 * There is a lot of variation at all levels between this application and the
 * original - draft factoring (axisDomData.js) showed a blow-out of abstraction
 * and complexity even before all the differences were handled.
 */

const className = "horizTick";

/** filter : @return true if the given Block is configured to display ticks.
 * i.e. ! block.block.get('dataset').get('showPaths')
 */
function blockWithTicks(block)
{
  let showPaths = block.block.get('showPaths');
  // dLog('blockWithTicks', block.axisName, showPaths);
  return ! showPaths;
}

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
}

/** Draw horizontal ticks on the axes, at feature locations.
 *
 * @param axis  block (Ember object), result of stacks-view:axesP
 * If the axis has multiple (data) blocks, this is the reference block.
 */
FeatureTicks.prototype.showTickLocations = function (featuresOfBlockLookup, setupHover, groupName, blockFilter)
{
  let axis = this.axis, axisApi = this.axisApi;
  let axisName = axis.axisName;
  let
    range0 = axis.yRange2();
  let
    axisObj = this.axis1d.get('axisObj'),
  /** using the computed function extended() would entail recursion. */
  extended = axisObj && axisObj.extended;
  if (trace_stack)
    dLog('showTickLocations', extended, axisObj, groupName);

  function blockTickEltId(block) { return className + '_' + groupName + '_' + block.axisName; }

  let blockIndex = {};
  let aS = selectAxis(axis);
  if (!aS.empty())
  {
    /** show no ticks if axis is extended. */
    let blocks = (extended ? [] : blockFilter ? axis.blocks.filter(blockWithTicks) : axis.blocks);
    let gS = aS.selectAll("g." + className + '.' + groupName)
      .data(blocks, blockKeyFn);
    gS.exit().remove();
    function storeBlockIndex (block, i) {
      blockIndex[block.getId()] = i;
      if (trace_stack)
        dLog('blockIndex', block.getId(), i);
    };
    let gA = gS.enter()
      .append('g')
      .attr('id', blockTickEltId)
      .attr('class', className + ' ' + groupName)
    ;
    /** data blocks of the axis, for calculating blockIndex i.e. colour.
     * colour assignment includes non-visible blocks . */
    let blocksUnfiltered = extended ? [] : axis.dataBlocks(false);
    if (trace_stack)
      dLog('blockIndex', axisName, axis, axis.blocks);
    blocksUnfiltered.forEach(storeBlockIndex);

    function featuresOfBlock (block) {
      function inRange(feature) {
        /** comment in @see keyFn() */
        let featureName = getAttrOrCP(feature, 'name');
        return axisApi.inRangeI(block.axisName, featureName, range0);
      }

      let blockR = block.block,
      blockId = blockR.get('id'),
      featuresAll = (featuresOfBlockLookup || function (blockR) {
        return blockR.get('features').toArray();
      })(blockR),
      features = featuresAll
        .filter(inRange);
      dLog(blockId, features.length);
      return features;
    };

    let gSA = gS.merge(gA),
    pS = gSA
      .selectAll("path." + className)
        .data(featuresOfBlock, keyFn),
      pSE = pS.enter()
        .append("path")
        .attr("class", className)
    ;
    function featurePathStroke (feature, i2) {
        let block = this.parentElement.__data__,
        blockId = block.getId(),
        /** Add 1 to i because it is the elt index, not the
         * index within axis.blocks[], i.e. the reference block is not included. */
        i = blockIndex[blockId];
      if (i2 < 2)
         dLog(this, 'stroke', blockId, i);
        return axisTitleColour(blockId, i+1) || 'black';
      }

    if (setupHover === true)
    {
    setupHover = 
    function setupHover (feature) 
    {
      let block = this.parentElement.__data__;
      return configureHorizTickHover.apply(this, [feature, block, hoverTextFn]);
    };

      pSE
        .each(setupHover);
    }
      pS.exit()
        .remove();
      let pSM = pSE.merge(pS);

      /* update attr d in a transition if one was given.  */
      let p1 = // (t === undefined) ? pSM :
         pSM.transition()
         .duration(axisTickTransitionTime)
         .ease(d3.easeCubic);

      p1.attr("d", pathFn)
      .attr('stroke', featurePathStroke)
    ;


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
     */
    let featureName = getAttrOrCP(feature, 'name');
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
    sLine = axisApi.lineHoriz(ak, tickY, xOffset, shiftRight);
    return sLine;
  };

  /** eg: "scaffold23432:1A:1-534243" */
  function hoverTextFn (feature, block) {
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
 * @property zoomed   selects either .zoomedDomain or .blocksDomain.  initially undefined (false).
 * @property flipped  if true then the domain is flipped in the view.  initially undefined (false).
 */
export default Ember.Component.extend(Ember.Evented, AxisEvents, AxisPosition, {
  blockService: service('data/block'),

  stacks : stacks,

  /** flipRegion implies paths' positions should be updated.  The region is
   * defined by brush so it is within the domain, so the domain does not change.
   */
  flipRegionCounter : 0,


  init() {
    this._super(...arguments);

    let axisName = this.get('axis.id');
    /* axisS may not exist yet, so give Stacked a reference to this. */
    Stacked.axis1dAdd(axisName, this);
    let axisS = this.get('axisS');
    if (! axisS) {
      dLog('axis-1d:init', this, axisName, this.get('axis'));
    }
    else if (axisS.axis1d === this) {
      // no change
    }
    else if (axisS.axis1d && ! axisS.axis1d.isDestroyed)
    {
      dLog('axis-1d:init', this, axisName, this.get('axis'), axisS, axisS && axisS.axis1d);
    }
    else {
      axisS.axis1d = this;
      if (trace_stack) {
        dLog('axis-1d:init', this, this.get('axis.id'), axisS); axisS.log();
      }
    }
  },


  /** axis-1d receives axisStackChanged and zoomedAxis from draw-map
   * zoomedAxis is specific to an axisID, so respond to that if it matches this.axis.
   */

  resized : function(widthChanged, heightChanged, useTransition) {
    /* useTransition could be passed down to showTickLocations()
     * (also could pass in duration or t from showResize()).
     */
    if (trace_stack)
      dLog("resized in components/axis-1d");
    if (heightChanged)
      this.renderTicksDebounce();
  },

  axisStackChanged : function() {
    dLog("axisStackChanged in components/axis-1d");
    this.renderTicksDebounce();
  },

  /** @return the Stacked object corresponding to this axis. */
  axisS : Ember.computed('axis.id', 'stacks.axesPCount', function () {
    let
      axisName = this.get('axis.id'),
    axisS = Stacked.getAxis(axisName);
    if (axisS) {
      if (axisS.axis1d === this && this.isDestroying)
        axisS.axis1d = undefined;
      else if (! axisS.axis1d && ! this.isDestroying) {
        axisS.axis1d = this;
      }
    }
    return axisS;
  }),
  /** new dataBlocks() is replacing this version, renamed as axisSdataBlocks().
   * @return data blocks of this axis.
   * These are the Ember records, not the stack Block-s.
   */
  axisSdataBlocks : Ember.computed('axisS', 'blockService.axesBlocks.@each', function () {
    let axis = this.get('axisS'),
    dataBlocks,
    axesBlocks = this.get('blockService.axesBlocks');
    if (! axis) {
      /* We can add a ComputedProperty for axes - allocate a Stack and Stacked
       * (axis) for newly viewed non-child blocks. */
      dataBlocks = [];
      let
        axisName = this.get('axis.id');
      dLog('dataBlocks', axesBlocks, axisName, dataBlocks);
    }
    else {
    let
    /** stack Block-s. */
      dataBlocksS = axis.dataBlocks();
      dataBlocks = dataBlocksS.map(function (b) { return b.block; });
    dLog(dataBlocksS, 'axesBlocks', axesBlocks, axis.axisName);
    }
    return dataBlocks;
  }),
  /** viewed blocks on this axis.
   * For just the data blocks (depends on .hasFeatures), @see dataBlocks()
   */
  viewedBlocks : Ember.computed('axis', 'blockService.axesViewedBlocks2.[]', function () {
    let
    blocks,
    axesBlocks = this.get('blockService.axesViewedBlocks2'),
    referenceBlock = this.get('axis');
      blocks = axesBlocks.get(referenceBlock);
      dLog('viewedBlocks', referenceBlock, axesBlocks, blocks);
    return blocks || [];
  }),
  dataBlocks : Ember.computed('viewedBlocks.@each.isData', function () {
    let
    /** block.isData is similar to the block.hasFeatures filtering which is done in loadedViewedChildBlocks() */
    dataBlocks = this.get('viewedBlocks')
      .filter((block) => block.get('isData'));
    dLog('dataBlocks', dataBlocks);
    return dataBlocks;
  }),

  /** Reverse map dataBlocks : map from blockId to index position within the dataBlocks[].
   *
   * This can replace storeBlockIndex(), which is defined in
   * showTickLocations(); that is calculated at render time, whereas this is
   * dependent on the base data.
   */
  blockIndexes : Ember.computed('viewedBlocks.[]', function () {
    // based on axis-tracks.js : blockIndexes(), translated to .reduce.
    let dataBlocks = this.get('viewedBlocks');
    let blockIndexes =
    dataBlocks.reduce(function (result, b, i) {
      let d = b.get('id');  result[d] = i; 
      return result;
    }, {});
    dLog('blockIndexes', blockIndexes, dataBlocks);
    return blockIndexes;
  }),
  colourSlotsUsed : Ember.A([]),
  /** assign colour slots to viewed blocks of an axis
   * e.g. slots 0-10 for schemeCategory10
   * @return array mapping colour slots to blocks, or perhaps blocks to slots
   */
  colourSlots : Ember.computed('dataBlocks.[]', function () {
    /* 
     * when .viewed blocks changes : for each viewed block
     * if it is viewed and does not have a colour slot assigned
     * look for a slot assigned to a block which is no longer viewed
     * if 1 found, re-use that slot
     * else use an incrementing count (maybe simply append - that would enable 2 identical colours after others are unviewed, but new allocations would be from the initial range because search from start)
     */
    let colourSlots,
    used = this.get('colourSlotsUsed');
    let dataBlocks = this.get('dataBlocks');
    if (trace_stack > 1)
      dLog('colourSlots', used, dataBlocks);
    dataBlocks.forEach((b) => {
      if (b.get('isViewed') && (this.blockColour(b) < 0)) {
        let free = used.findIndex(function (bi, i) {
          return !bi || !bi.get('isViewed');
        });
        if (free > 0)
          used[free] = b;
        else
          used.push(b);
      }
    } );
    colourSlots = used;
    if (trace_stack)
      dLog('colourSlots', colourSlots);
    return colourSlots;
  }),
  blockColour(block) {
    let used = this.get('colourSlotsUsed'),
    i = used.indexOf(block);
    return i;
  },
  /** @return the domains of the data blocks of this axis.
   * The result does not contain a domain for data blocks with no features loaded.
   */
  dataBlocksDomains : Ember.computed('dataBlocks.@each.featuresDomain', function () {
    let dataBlocks = this.get('dataBlocks'),
    dataBlockDomains = dataBlocks.map(function (b) { return b.get('featuresDomain'); } )
    /* featuresDomain() will return undefined when block has no features loaded. */
      .filter(d => d !== undefined);
    return dataBlockDomains;
  }),
  referenceBlock : Ember.computed.alias('axisS.referenceBlock'),
  /** @return the domains of all the blocks of this axis, including the reference block if any.
   * @description related @see axesDomains() (draw/block-adj)
   */
  blocksDomains : Ember.computed('dataBlocksDomains.[]', 'referenceBlock.range', function () {
    let
      /* alternative :
       * dataBlocksMap = this.get('blockService.dataBlocks'),
       * axisId = this.get('axis.id'),
       * datablocks = dataBlocksMap.get(axisId),
       */
      /** see also domainCalc(), blocksUpdateDomain() */
      blocksDomains = this.get('dataBlocksDomains'),
    /** equivalent : Stacked:referenceDomain() */
    referenceRange = this.get('referenceBlock.range');
    if (referenceRange) {
      dLog('referenceRange', referenceRange, blocksDomains);
      blocksDomains.push(referenceRange);
    }
    return blocksDomains;
  }),
  /** @return the union of blocksDomains[], i.e. the interval which contains all
   * the blocksDomains intervals.
   */
  blocksDomain : Ember.computed('blocksDomains.[]', function () {
    let 
      blocksDomains = this.get('blocksDomains'),
    domain = intervalExtent(blocksDomains);
    dLog('blocksDomain', blocksDomains, domain);
    return domain;
  }),
  /** if domain is [0,0] or [false, false] then consider that undefined. */
  domainDefined : Ember.computed('domain.0', 'domain.1', function () {
    let domain = this.get('domain'),
    defined = ! noDomain(domain);
    return defined;
  }),
  blocksDomainEffect_unused : Ember.computed('blocksDomain', function () {
    let domain = this.get('blocksDomain'),
    domainDefined = this.get('domainDefined');
    if (domainDefined && ! this.get('zoomed'))
      /* defer setting yDomain to the end of this render, to avoid assert fail
       * re. change of domainChanged, refn issues/13948;
       * that also breaks progressive loading and axis & path updates from zoom.
       */
      Ember.run.later(() => {
        this.setDomain(domain);
      });
  }),
  /** Update the domain of the Y scales. */
  updateScaleDomain() {
    if (this.isDestroyed) return undefined;
    let domain = this.get('domain'),
    domainDefined = this.get('domainDefined');
    if (domain && domainDefined) {
      /* Similar to this.updateDomain(), defined in axis-position.js, */
      let axisS = this.get('axisS');
      dLog('updateScaleDomain', domain, axisS);
      if (axisS) {
        let y = axisS.getY(), ys = axisS.ys;
        updateDomain(axisS.y, axisS.ys, axisS, domain);
      }
    }
    return domain;
  },
  /** This is the currently viewed domain.
   * @return if zoomed return the zoom yDomain, otherwise blockDomain.
   */
  domain : Ember.computed('zoomed', 'flipped', 'blocksDomain', 'zoomedDomain', function () {
    /** Actually .zoomedDomain will be == blocksDomain when not zoomed, but
     * using it as a CP dependency causes problems, whereas blocksDomain has a
     * more direct dependency on axis' blocks' features' locations.
     * When .zoomed is set, .zoomedDomain may be undefined briefly; if so use .blocksDomain.
     */
    let domain = this.get('zoomed') ? this.get('zoomedDomain') || this.get('blocksDomain') : this.get('blocksDomain');
    if (this.get('flipped')) {
      domain = [domain[1], domain[0]];
    }
    return domain;
  }),


  /** count of features of .dataBlocks
   * Maybe : Also depend on block.featuresForAxis, to trigger a request for features of
   * a block when it is added to an axis.
   */
  featureLength : Ember.computed('dataBlocks.@each.{featuresLength,featuresForAxis}', function () {
    let dataBlocks = this.get('dataBlocks'),
    featureLengths = dataBlocks.map(function (b) { return b.get('featuresLength'); } ),
    featureLength = sum(featureLengths);
    /** This is only intended to trigger an initial featuresForAxis, but changes
     * in dataBlocks[*].featuresLength will trigger this CP, so it would be
     * recursive to request featuresForAxis here.
     * If enabled this seems to cause "Cannot read property 'nextSibling' of null" in DOMChanges.insertAfter (runtime.js)
     * seemingly because of multiple requests in a short time.
     */
    let featuresForAxis; // = dataBlocks.map(function (b) { return b.get('featuresForAxis'); } );
    dLog(this, dataBlocks, featureLengths, 'featureLength', featureLength, featuresForAxis /*.length*/);
    let axisS = this.get('axisS'); if (axisS && trace_stack) axisS.log();
    return featureLength;
  }),
  /** When featureLength changes, render.
   * The suffix Effect is used to denote a Side Effect triggered by a CF.
   */
  featureLengthEffect : Ember.computed('featureLength', 'flipRegionCounter', 'axisS', function () {
    let featureLength = this.get('featureLength');

    this.renderTicksDebounce();
    let axisApi = stacks.oa.axisApi,
    /** defined after first brushHelper() call. */
    axisFeatureCirclesBrushed = axisApi.axisFeatureCirclesBrushed;
    if (axisFeatureCirclesBrushed)
      axisFeatureCirclesBrushed();

    /** Update the featureCount shown in the axis block title */
    this.axisTitleFamily();
    if (featureLength)
      dLog('featureLengthEffect', this.get('axis.id'), featureLength);

    return featureLength;
  }),
  axisTitleFamily() {
    let axisApi = stacks.oa.axisApi;
    let axis = this.get('axisS');
    if (axis) {
      let
        gAxis = axis.selectAll(),
      axisTitleS = gAxis.select("g.axis-outer > g.axis-all > text");
      dLog(
        'axisTitleFamily', axisTitleS.nodes(), axisTitleS.node(),
        gAxis.nodes(), gAxis.node());
      axisApi.axisTitleFamily(axisTitleS);
    }
  },
  updateAxisTitleSize() {
    let axisApi = stacks.oa.axisApi;
    let axis = this.get('axisS');
    if (axis) {
      let
        gAxis = axis.selectAll();
      axisApi.updateAxisTitleSize(gAxis);
    }
  },


  /** @param [axisID, t] */
  zoomedAxis : function(axisID_t) { },
  zoomedAxis_unused : function(axisID_t) {
    let axisID = axisID_t[0],
    axisName = this.get('axis.id');
    dLog("zoomedAxis in components/axis-1d", axisID_t, axisName);
    if (axisID == axisName)
    {
      dLog('zoomedAxis matched', axisID, this.get('axis'));
      // Not currently needed because axisStackChanged() already received.
      // this.renderTicksDebounce.apply(this, axisID_t);
      let axisS = this.get('axisS'),
      dimensions = axisS.axisDimensions();
      dLog('zoomedAxis setDomain', this.get('domain'), this.get('currentPosition'), this.get('currentPosition.yDomain'), dimensions.domain);
      this.setDomain(dimensions.domain);
      // this.set('zoomed', dimensions.zoomed);
      dLog('zoomedAxis', axisS, dimensions);
    }
  },
  setDomain_unused(domain) {
    let
      attr = this.get('domain');
    let cpDomain = this.get('currentPosition.yDomain');
    /* verification - this confirms that if zoomedAxis() -> setDomain() then
     * .currentPosition.yDomain has already been set to domain.
     * So zoomedAxis() and setDomain() are disabled by appending _unused to their names.
     */
    if (! isEqual(cpDomain, domain)) {
      dLog('setDomain', cpDomain, domain, attr);
    }
    if (! attr)
      this.set('domain', Ember.A(domain));
    else
    {
      domain.forEach((d, i) => {
        this.set('domain.' + i, d);
      });
    }
    dLog('setDomain', domain, attr /*, this.attrs*/);
  },
  /** position when last pathUpdate() drawn. */
  position : Ember.computed.alias('lastDrawn.yDomain'),
  /** position as of the last zoom. */
  zoomedDomain : Ember.computed.alias('currentPosition.yDomain'),

  /** Updates when the array elements of .domain[] update.
   *  @return undefined; value is unused.
   */
  domainChanged : Ember.computed(
    'domain.0', 'domain.1',
    function () {
      if (this.isDestroyed) return undefined;
      let domain = this.get('domain'),
      domainDefined = this.get('domainDefined');
      // domain is initially undefined or []
      if (domain && domainDefined) {
        // use the VLinePosition:toString() for the position-s
        dLog('domainChanged', domain, this.get('axisS'), ''+this.get('currentPosition'), ''+this.get('lastDrawn'));
        // this.notifyChanges();
        if (! this.get('axisS'))
          dLog('domainChanged() no axisS yet', domain, this.get('axis.id'));
        else {
          this.updateScaleDomain();
          this.updateAxis();
        }
      }
      return domainDefined && domain;
    }),
  /** Update when the domain has changed and the scale has been updated.
   */
  scaleChanged : Ember.computed('domainChanged', function () {
    let scale, domainDefined = this.get('domainChanged');
    dLog('scaleChanged', domainDefined);
    if (domainDefined) {
      let axisS = this.get('axisS');
      if (axisS) {
        let y = axisS.getY(), ys = axisS.ys;
        scale = y;
      }
    }
    return scale;
  }),
  notifyChanges() {
    let axisID = this.get('axis.id');
    dLog('notifyChanges', axisID);

    let axisApi = stacks.oa.axisApi;
    let t = stacks.oa.svgContainer.transition().duration(750);

    let eventBus = stacks.oa.eventBus;

    let p = axisID;
    eventBus.trigger("zoomedAxis", [axisID, t]);
    // true does pathUpdate(t);
    axisApi.axisScaleChanged(p, t, true);

    axisApi.axisStackChanged(t);
  },
  updateAxis() {
    // subset of notifyChanges()
    let axisApi = stacks.oa.axisApi;
    let axisID = this.get('axis.id');
    dLog('updateAxis', axisID);
    let t = stacks.oa.svgContainer.transition().duration(750);
    axisApi.axisScaleChanged(axisID, t, true);
  },

  ensureAxis : Ember.computed('viewedBlocks', function () {
    let viewedBlocks = this.get('viewedBlocks');
    let axisApi = stacks.oa.axisApi;
    let count = viewedBlocks.length;
    viewedBlocks.forEach((block) => {
      if (! block.get('axis'))
        axisApi.ensureAxis(block.id);
      if (! block.get('axis'))
        count--;
    });
    return count;
  }),

  extendedEffect : Ember.computed('extended', function () {
    let
    extended = this.get('extended'),
    axisID = this.get('axis.id');
    dLog('extended', extended, axisID);
    if (extended)
      this.removeTicks();
    else
    {
      let axisID_t = [axisID, undefined];
      this.renderTicksDebounce(axisID_t);
    }
    /* .extended has changed, so the centre of the axisTitle is changed. */
    this.updateAxisTitleSize();

    return extended;
  }),

  didReceiveAttrs() {
    this._super(...arguments);
    this.get('featureTicks') || this.constructFeatureTicks();
  },
  didInsertElement() {
    this._super(...arguments);
    dLog('axis-1d didInsertElement', this, this.get('listen') !== undefined);
  },
  willDestroyElement() {
    dLog('willDestroyElement', this.get('axis.id'));
    this.removeTicks();
    let axisS = this.get('axisS');
    if (axisS) {
      if (axisS.axis1d === this)
        delete axisS.axis1d;
    }
    let axisName = this.get('axis.id');
    Stacked.axis1dRemove(axisName, this);

    this._super(...arguments);
  },
  removeTicks() {
    /** Select all the <path.horizTick> of this axis and remove them.
     * Could use : this.renderTicks() because when ! axis.extended,
     * showTickLocations() will use features == [], which will remove ticks;
     */
    let axis = this.get('axis'),
    aS = selectAxis(axis),
    pS = aS.selectAll("path." + className);
    pS.remove();
  },
  didRender() {
    this.renderTicksDebounce();
  },
  constructFeatureTicks () {
    /** There is 1 axis-1d component per axis, so here `block` is an axis (Stacked),
     * Can rename it to axis, assuming this structure remains.
     */
    let block = this.get('axis'), blockId = block.get('id');
    dLog('constructFeatureTicks', blockId, this);
    let axisApi = this.get('drawMap.oa.axisApi');
    let oa = this.get('drawMap.oa');
    let axis = oa.axes[blockId];
    // dLog('axis-1d renderTicks', block, blockId, axis);

    /* If block is a child block, don't render, expect to get an event for the
     * parent (reference) block of the axis. */
    if (! axis)
      dLog('renderTicks block', block, blockId, oa.stacks.blocks[blockId]);
    else {
      let featureTicks = new FeatureTicks(axis, axisApi, this);
      dLog('featureTicks', featureTicks);
      this.set('featureTicks',  featureTicks);
    }
  },
  renderTicks() {
    let featureTicks = this.get('featureTicks');
    if (! featureTicks && this.get('axisS')) {
      this.constructFeatureTicks();
      featureTicks = this.get('featureTicks');
    }
    if (! featureTicks)
      dLog('renderTicks', featureTicks);
    else
      featureTicks.showTickLocations(undefined, true, 'notPaths', true);
  },
  /** call renderTicks().
   * filter / debounce the calls to handle multiple events at the same time.
   * @param axisID_t is defined by zoomedAxis(), undefined when called from
   * axisStackChanged()
   */
  renderTicksDebounce(axisID_t) {
    // dLog('renderTicksDebounce', axisID_t);
    // renderTicks() doesn't use axisID_t; this call chain is likely to be refined yet.
    /* using throttle() instead of debounce() - the former has default immediate==true.
     * It is possible that the last event in a group may indicate a change which
     * should be rendered, but in this case it is likely there is no change
     * after the first event in the group.
     */
    Ember.run.throttle(this, this.renderTicks, axisID_t, 500);
  }


  
});

