import { on } from '@ember/object/evented';
import $ from 'jquery';
import {
  once,
  later,
  debounce,
  bind,
  throttle
} from '@ember/runloop';
import { computed, get, set as Ember_set, observer } from '@ember/object';
import { alias, filterBy } from '@ember/object/computed';
import Evented from '@ember/object/evented';
import Component from '@ember/component';
import { inject as service } from '@ember/service';
import { A as Ember_array_A } from '@ember/array';

import { task, timeout, didCancel } from 'ember-concurrency';

import createIntervalTree from 'interval-tree-1d';

import { isEqual } from 'lodash/lang';
import { debounce as lodash_debounce, throttle as lodash_throttle } from 'lodash/function';


/* global require */


/* Originally used scheduleIntoAnimationFrame() from github.com/runspired/ember-run-raf
 * which uses github.com/kof/animation-frame to wrap requestAnimationFrame().
 * Installed via : npm --expose-internals install --save ember-run-raf
 * Tried import, e.g.  import scheduleIntoAnimationFrame from 'npm:ember-run-raf/addons/utils/schedule-frame';
 * Seems not updated to Ember 3.22
 *
 * Now using : github.com/html-next/ember-raf-scheduler
 */

import { scheduler } from 'ember-raf-scheduler';


/*----------------------------------------------------------------------------*/

import config from '../config/environment';
import { EventedListener } from '../utils/eventedListener';
import { chrData, cmNameAdd } from '../utils/utility-chromosome';
import {
  eltWidthResizable,
  eltResizeToAvailableWidth,
  ctrlKeyfilter,
  noKeyfilter,
  eltClassName,
  tabActive,
  inputRangeValue,
  expRange
} from '../utils/domElements';
import { I, combineFilters } from '../utils/draw/d3-svg';
import {
  /*fromSelectionArray,
  */ logSelectionLevel,
  logSelection,
  logSelectionNodes,
  selectImmediateChildNodes
} from '../utils/log-selection';
import { configureHover } from '../utils/hover';
import { Viewport } from '../utils/draw/viewport';
import { AxisTitleLayout } from '../utils/draw/axisTitleLayout';
import { AxisTitleBlocksServers } from '../utils/draw/axisTitleBlocksServers_tspan';
import {
  brushClip,
  axisBrushSelect,
  showAxisZoomResetButtons
} from '../utils/draw/axisBrush';

import {  Axes, maybeFlip, maybeFlipExtent,
          ensureYscaleDomain,
          /*yAxisTextScale,*/  yAxisTicksScale,  yAxisBtnScale, yAxisTitleTransform,
          eltId, axisEltId, eltIdAll, axisEltIdTitle,
          axisFeatureCircles_eltId,
          axisFeatureCircles_selectAll,
          axisFeatureCircles_selectOneInAxis,
          axisFeatureCircles_removeBlock,
          /*, axisTitleColour*/  }  from '../utils/draw/axis';
import { stacksAxesDomVerify }  from '../utils/draw/stacksAxes';
import {
  Block,
  Stacked,
  Stack,
  stacks,
  xScaleExtend,
  axisRedrawText,
  axisId2Name,
  setCount
} from '../utils/stacks';
import {
  collateAdjacentAxes,
  log_adjAxes,
  log_adjAxes_a,
  isAdjacent
} from '../utils/stacks-adj';
import { updateRange } from '../utils/stacksLayout';
import {
  DragTransition,
  dragTransitionTime,
  dragTransitionNew,
  dragTransition
} from '../utils/stacks-drag';
import { subInterval, overlapInterval, wheelNewDomain } from '../utils/draw/zoomPanCalcs';
import { round_2, checkIsNumber } from '../utils/domCalcs';
import { Object_filter, compareFields } from '../utils/Object_filter';
import {
  name_chromosome_block,
  name_position_range,
  isOtherField
} from '../utils/field_names';
import { breakPoint, breakPointEnableSet } from '../utils/breakPoint';
import { highlightFeature_drawFromParams } from './draw/highlight-feature';
import { Flow } from "../utils/flows";
import {
  flowButtonsSel,
  configurejQueryTooltip,
  flows_showControls
} from "../utils/draw/flow-controls";
import { collateStacks, countPaths, /*countPathsWithData,*/
         collateData, collateFeatureClasses, maInMaAG, collateStacks1,
         pathsUnique_log, log_maamm, log_ffaa, mmaa2text,
         getAliased, collateStacksA, objPut,
         aliasesText, aliasText,
         addPathsToCollation, addPathsByReferenceToCollation,
         storePath, filterPaths,
         collateFeatureMap, concatAndUnique, featureStackAxes,
         collateMagm
       } from "../utils/draw/collate-paths";
/** We can replace countPathsWithData() (which does a DOM search and is not
 * updated for progressive paths), with a sum of (pathsResult.length +
 * pathsAliasesResult.length) for all block-adj in flows.blockAdjs
 */
function countPathsWithData() { }
import { storeFeature, lookupFeature } from '../utils/feature-lookup';

import { configureSyntenyBlockClicks } from './draw/synteny-blocks';


/*----------------------------------------------------------------------------*/

/* jshint curly : false */

/* these warnings are sometimes useful, but they are causing "Too many errors. (89% scanned)." */
/* jshint -W087 */
/* jshint -W032 */
/* jshint -W116 */
/* jshint -W098 */
/* jshint -W014  */
/* jshint -W030 */
/* jshint -W083 */

/*global d3 */
/* global CSS */

/*----------------------------------------------------------------------------*/

let trace_dataflow = 0;

const dLog = console.debug;

Object.filter = Object_filter;

/** true means syntenyBlock is defined by 2 features instead of 4 feature names.
 *   true : chr1 chr2 g1 undefined g3 undefined id size
 *   false : chr1 chr2 g1 g2 g3 g4 id size
 * This can be based on path.feature[].blockId.isSyntenyBlock
 */
const syntenyBlock_2Feature = true;

/** enable display of multiple lines in axis title : for each data block :
 * name, block colour, feature counts, server colour; this is moving into axis
 * menu, replacing utils/draw/axisTitleBlocksServers{,_tspan}.js.
 */
const axisTitle_dataBlocks = false;

/*----------------------------------------------------------------------------*/

//- moved to "../utils/draw/flow-controls.js" : flowButtonsSel, configurejQueryTooltip()

/*----------------------------------------------------------------------------*/

/** compareFn param for compareFields */
function compareViewport(keyName, a, b) {
  let different;
  if (keyName === 'viewportWidth') {
    /** viewportWidth may cycle due to the rendering affecting the geometry (seen once, in Firefox). */
    different = ((a === undefined) !== (b === undefined)) || Math.abs(a - b) > 5;
  } else {
    different = a !== b;
  }
  return different;
}
/*----------------------------------------------------------------------------*/




export default Component.extend(Evented, {
  classNames: ['draw-map-container'],

  store: service('store'),
  blockService: service('data/block'),
  flowsService: service('data/flows-collate'),
  pathsP : service('data/paths-progressive'),
  axisZoom : service('data/axis-zoom'),
  headsUp : service('data/heads-up'),
  queryParamsService: service('query-params'),
  apiServers : service(),
  controlsService : service('controls'),
  selectedService : service('data/selected'),

  /*--------------------------------------------------------------------------*/
  urlOptions : alias('queryParamsService.urlOptions'),

  /*------------------------------------------------------------------------*/
//-  graphData: Ember.inject.service('graph-data'),
  /*------------------------------------------------------------------------*/

  drawActionsListen: function(listen, name, target, method) {
    /** drawActions is an action&event bus specific to one draw-map; it is a reference
     * to mapview (see map-view.hbs) but could be owned by the draw-map. */
    let drawActions = this.get('drawActions'); 
    console.log("drawActionsListen", listen, name, target._debugContainerKey, method, drawActions, this);
    if (drawActions === undefined)
      console.log('parent component drawActions not passed', this);
    else
    {
      // let onOff = listen ? drawActions.on : drawActions.off;
        if (listen)
          drawActions.on(name, target, method);
        else
          drawActions.off(name, target, method);
      }
  },

  drawControlsListen(listen)
  {
    this.drawActionsListen(listen, 'drawControlsLife', this, this.drawControlsLife);
  },
  /** handle life-cycle events (didInsertElement, willDestroyElement) from draw-controls. */
   drawControlsLife : function(start) {
     console.log("drawControlsLife in components/draw-map (drawActions)", start);
     if (this.drawControlsLifeC)
       this.drawControlsLifeC(start);
   },
 
  /** Listen for actions from sub-components of draw-map.
   * Both mapview and draw-map component are Evented, and are used as event buses
   * for components defined within their templates.
   *
   * Also  @see drawActionsListen(), drawControlsListen(), which connect to the mapview event bus.
   * Based on components/goto-features createListener().
   */
  createListener(bus) {
    if (bus === undefined)
      console.log('Evented component not passed', bus);
    else
      this.set('listener', new EventedListener(
        bus,
        [{name: 'stackPositionsChanged', target: this, method: /*.actions.*/this.stackPositionsChanged}]
        // this.pathUpdateFlow is set later, because it calls into the draw() closure.
      ));
  },
  stackPositionsChanged(stack) {
    this.actions.stackPositionsChanged(stack);
  },

  /** listen to events sent by sub-components.
   * Called when init and willDestroyElement. */
  localBus : function (listen) {
    if (listen && this.get('listener') === undefined)
    {
      let oa = this.get('oa');

      /* oa.eventBus is used in stacks to send updatedStacks and stackPositionsChanged; 
       * perhaps change ownership of those events to a stacks Evented component. */
      let bus = this;
      if (oa.eventBus !== this) {
        Ember_set(oa, 'eventBus', this);
      }
      if (this.get('listener') === undefined)
        this.createListener(bus);
    }
    if (this.listener)
      this.listener.listen(listen);
    if (! listen && this.pathUpdateFlow)
      this.off('pathUpdateFlow', this, this.pathUpdateFlow);
  },

  /*------------------------------------------------------------------------*/

  /** Used for receiving colouredFeatures from selected-features.js,
   * and flipRegion, ...
   */
  feedService: (console.log("feedService"), service('feed')),

    /** these actions on feedService can be moved to drawActions;
     * feedService is global, whereas drawActions is specific to a single draw-map;
     * currently there is only one draw-map, but having multiple draw-maps in
     * one browser tab would be useful.
     */
  listen: on('init', function() {
    let f = this.get('feedService');
    console.log("listen", f);
    if (f === undefined)
    {
      console.log('listen() : feedService undefined', this);
      breakPoint();
    }
    else {
      f.on('colouredFeatures', this, 'updateColouredFeatures');
      f.on('clearScaffoldColours', this, 'clearScaffoldColours');
      f.on('flipRegion', this, 'flipRegion');
      f.on('resetZooms', this, 'resetZooms');
    }

    this.oa = {};
    this.drawControlsListen(true);
    this.localBus(true);
    let blockService = this.get('blockService');
    blockService.on('receivedBlock', this, 'receivedBlock');
    this.functionHandles = {};
  }),

/** addPathsToCollation() was in draw closure;  having moved it to library collate-paths.js, it could now be register here
  willInsertElement : function () {
    console.log("components/draw-map willInsertElement");
    this._super(...arguments);
    this.on('paths', addPathsToCollation);
  },
*/

  // remove the binding created in listen() above, upon component destruction
  cleanup: on('willDestroyElement', function() {
    let f = this.get('feedService');
    f.off('colouredFeatures', this, 'updateColouredFeatures');
    f.off('clearScaffoldColours', this, 'clearScaffoldColours');
    f.off('flipRegion', this, 'flipRegion');
    f.off('resetZooms', this, 'resetZooms');

    this.drawControlsListen(false);
    this.localBus(false);

    /* not registered in willInsertElement(). registered in draw() : drawControlsLifeC */
    if (this.has('paths')) {
      this.off('paths', addPathsToCollation);
    }

    let blockService = this.get('blockService');
    blockService.off('receivedBlock', this, 'receivedBlock');

  }),

//{
  /** undefined, or a function to call when colouredFeatures are received  */
  colouredFeaturesChanged : undefined,

  updateColouredFeatures: function(features) {
    console.log("updateColouredFeatures in components/draw-map.js");
    let self = this;
    this.get('scroller').scrollVertical('#holder', {
      duration : 1000,
      // easing : 'linear', // default is swing
      offset : -60
    }).then(function () {
      let colouredFeaturesChanged = self.get('colouredFeaturesChanged');
      if (colouredFeaturesChanged)
        colouredFeaturesChanged(features);
    });
  },

  draw_flipRegion : undefined,
  flipRegion: function(features) {
    console.log("flipRegion in components/draw-map.js");
    let flipRegion = this.get('draw_flipRegion');
    if (flipRegion)
      flipRegion(features);
  },
//}

  /*------------------------------------------------------------------------*/

  /** Initialise in init(), so that each new instance of draw-map gets a
   * distinct object, so that functions don't refer to destroyed closures.
   */
  functionHandles : undefined,
  /** @return a constant value for the function
   * @desc for use with debounce / throttle
   */
  functionHandle(name, fn) {
    let functions = this.get('functionHandles');
    if (false) { // debug check / trace
      if (! functions.drawMap) { functions.drawMap = this; }
      else if (functions.drawMap !== this) { dLog('functionHandle', functions, this); }
    }
    if (functions[name] && (functions[name] !== fn) && (trace_dataflow > 2)) {
      dLog('functionHandle', name, functions[name], fn);
    }      
    let
    fnStored = functions[name] || (functions[name] = fn);
    return fnStored;
  },

  /*------------------------------------------------------------------------*/
  
  scroller: service(),

  axes1d : computed( function () { return stacks.axes1d; }),
  splitAxes: filterBy('axes1d', 'extended', true),

  axisTicks : alias('controls.view.axisTicks'),

  /** Enable frontend collation of paths : pathUpdate_() / collate-paths.js
   * The user sets this via GUI input in panel/view-controls.
   * Same effect as me.get('urlOptions.pathsCheck'); if pathJoinClient is
   * available in GUI, then urlOptions.pathsCheck is not required.
   */
  pathJoinClient : alias('controls.view.pathJoinClient'),

  /** initialised to default value in components/panel/view-controls.js */
  sbSizeThreshold : alias('controls.view.sbSizeThreshold'),

  /** Draw paths between features on Axes even if one end of the path is outside the svg.
   * This was the behaviour of an earlier version of this Feature Map Viewer, and it
   * seems useful, especially with a transition, to show the progressive exclusion of
   * paths during zoom.
   * Users also report this is useful when viewing synteny blocks.
   */
  allowPathsOutsideZoom : computed('controls.view.tickOrPath', function () {
    return this.get('controls.view.tickOrPath') === 'path'; }),

  /** enable display of stacks-frames */
  showStacksFrames : false,

  /*------------------------------------------------------------------------*/

  xOffsets : {},
  xOffsetsChangeCount : 0,

  // ---------------------------------------------------------------------------

  actions: {
//-	?
    updatedSelectedFeatures: function(selectedFeatures) {
      /* run once to handle multiple settings of selectedFeatures (panel/left-panel and draw/axis-1d)
       * selectedFeatures is good candidate for converting to a model, simplifying this.
       */
      once(this, selectedFeaturesSendArray, selectedFeatures);
      function selectedFeaturesSendArray(selectedFeatures) {
      let featuresAsArray = d3.keys(selectedFeatures)
        .map(function (key) {
          return selectedFeatures[key].map(function(feature) {
            /** feature is now the Ember object models/feature 
             * Until 0eeda0a7, feature contained feature name and position, separated by " ".
             */
            let selectedFeature = {
              Chromosome : key,
              Feature : feature.name,
              Position : feature.location, /* i.e. .value[0]*/
              /** Chromosome, Feature and Position can be derived from
               * feature, so after the various uses of this are
               * changed to use .feature, the structure can be
               * replaced by simply feature.
               */
              feature
            };
            return selectedFeature;
          });
        })
        .reduce(function(a, b) { 
          return a.concat(b);
        }, []);
      // console.log(featuresAsArray);
      console.log("updatedSelectedFeatures in draw-map component",
                  selectedFeatures, featuresAsArray.length);
      this.sendAction('updatedSelectedFeatures', featuresAsArray);
      }
    },

    updatedStacks: function(stacks) {
      let stacksText = stacks.toString();
      // stacks.log();
      console.log("updatedStacks in draw-map component");
    },

    stackPositionsChanged : function(stack) {
      console.log("stackPositionsChanged in components/draw-map (drawActions)", stack);
      let oa = this.get('oa');  // , stack = oa.stacks[stackID];
      // console.log(oa.stacks, stack);
      stack.axes.forEach(
        function (a, index)
        {
          updateRange(oa.y, oa.ys, oa.vc, a);
        });
    },

    addMap : function(mapName) {
      dLog("controller/draw-map", "addMap", mapName);
      this.sendAction('addMap', mapName);
    },

    removeBlock(block) {
      dLog('removeBlock', block.id);
      this.sendAction('removeBlock', block);
    },


    enableAxis2D: function(axisID, enabled) {
      let axes1d = this.get('axes1d') || this.get('oa.stacks.axes1d');
      let axis = axes1d[axisID];
      if (axis === undefined)
      {
        dLog('enableAxis2D()', enabled, "no", axisID, "in", axes1d);
      }
      else
        later(
          () => axis.set('extended', enabled));  // was axis2DEnabled
      console.log("enableAxis2D in components/draw-map", axisID, enabled, axis);
      console.log("splitAxes", this.get('splitAxes'));
    },

    resizeView : function()
    {
      console.log("resizeView()");
      // resize();
    }

  },

  /** set attribute name of this to value, if that is not the current value.
   * It is expected that value is not a complex type.
   */
  ensureValue : function(name, value)
  {
    if (this.get(name) != value)
      this.set(name, value);
  },


  /** object attributes. initialised in init(). */
  oa : undefined,

  /*------------------------------------------------------------------------------*/

  peekBlock : function(blockId) {
    let blockService = this.get('blockService');
    return blockService.peekBlock(blockId);
  },

  receivedBlock : function (blocks) {
    console.log('receivedBlock', this, blocks);
    let retHash = 
      blocks.reduce((retHash, b) => {
      let block = b.obj;
    // copied from dataObserver() (similar to drawPromisedChr()) - can simplify and rename ch -> block, chr -> blockId, 
    let
      ch = block,
    chr  = block.get('id'),
                    rc = chrData(ch);
                    /** use same structure as routes/mapview.js */
                    retHash[chr] = rc;
    const receiveChr = this.receiveChr || console.log;
    this.get('receiveChr')(chr, rc, 'dataReceived');
      return retHash;
    }, {});

    later( () => {
      /* Cause the evaluation of stacks-view:axesP; also evaluates blockAdjIds,
       * and block-adj.hbs evaluates paths{,Aliases}ResultLength and hence
       * requests paths.  This dependency architecture will be made clearer.  */
      this.get('flowsService.blockAdjs');
      this.draw(retHash, 'dataReceived');
    });
  },


  /** Draw the Axes (Axis Pieces) and the paths between them.
   * Axes are Axis Pieces; in this first stage they correspond to chromosomes,
   * but the plan is for them to represent other data topics and types.
   * Each Chromosome is a part of a genetic map in this application.
   *
   * @param myData array indexed by myAPs[*]; each value is a hash indexed by
   * <mapName>_<chromosomeName>, whose values are an array of features {location,
   * map:<mapName>_<chromosomeName>, feature: featureName}
   * The index value is referred to as axisName (axis - Axis Piece) for generality
   * (originally "mapName", but it actually identifies a chromosome within a map).
   *
   * @param myData hash indexed by axis names
   * @param source 'didRender' or 'dataReceived' indicating an added map.
   */
  draw: function(myData, source) {
    const trace_stack = 0;

    let flowsService = this.get('flowsService');
    let myDataKeys;
    if (source === 'didRender')
    {
      myData = {};
    }
    myDataKeys = d3.keys(myData);
    dLog("draw()", myData, myDataKeys.length, source);

    // Draw functionality goes here.
    let me = this;

    let oa = this.get('oa');

    if (this.drawControlsLifeC === undefined)
    {
      console.log("set(drawControlsLife) (drawActions)", this, oa.stacks === undefined);
      /** It is sufficient to connect the graph drawing control panel life cycle
       * events to setupVariousControls() within the draw() closure, and it then
       * references other functions within that closure.
       * The individual controls can be factored out, e.g. creating an event API
       * for each control to deliver events from the component to the drawing.
       */
      this.set('drawControlsLifeC', function(start) {
        console.log("drawControlsLife in components/draw-map  (drawActions)", start);
        if (start)
          setupVariousControls();
      });

      /** currently have an instance of goto-feature in mapview.hbs (may remove
       * this - also have it via draw-map.hbs -> path-hover.hbs with data=oa ->
       * feature-name.hbs -> goto-feature ); this is just to get oa to that instance; not
       * ideal.  */
      let drawActions = this.get('drawActions'); 
      drawActions.trigger('drawObjectAttributes', this.get('oa')); // 
      console.log("draw() drawActions oa", drawActions, oa);

      this.on('paths', addPathsToCollation);
      this.on('pathsByReference', addPathsByReferenceToCollation);
    }

    // instanceChanged is defined below;  not needed because setting to the same value is harmless.
    // if ((oa.showResize === undefined) || instanceChanged)
    {
      oa.showResize = showResize;
    }

    /*------------------------------------------------------------------------*/



    if (oa.__lookupGetter__('stacks'))
      this.set('stacks', stacks);
    else
      oa.stacks = stacks;
    stacks.init(oa);
    // stacks.axes[] is a mix of Stacked & Block; shouldn't be required & planning to retire it in these changes.
    oa.axes = stacks.axesP;
    oa.axesP = stacks.axesP;
    /** Refresh axisApi when draw-map object instance changes, so the functions
     * do not refer to closures in the destroyed instance. */
    let instanceChanged;
    if (! oa.axisApi || (instanceChanged = oa.axisApi.drawMap.isDestroying)) {
      const axisApi = {lineHoriz : lineHoriz,
                    inRangeI : inRangeI,
                    featureInRange,
                    patham,
                    axisName2MapChr,
                    collateO,
                    updateXScale,
                    updateAxisTitleSize,
                    axisStackChanged,
                    axisScaleChanged,
                    axisRange2Domain,
                    cmNameAdd,
                    makeMapChrName,
                    axisIDAdd,
                    stacksAxesDomVerify : function (unviewedIsOK = false) { stacksAxesDomVerify(stacks, oa.svgContainer, unviewedIsOK); } ,
                    updateSyntenyBlocksPosition : () => this.get('updateSyntenyBlocksPosition').perform(),
                    drawMap : this,  // for debug trace / check.
                   };
      Ember_set(oa, 'axisApi', axisApi);
    }
    dLog('draw-map stacks', stacks);

    /** Reference to all datasets by name.
     * (datasets have no id, their child blocks' datasetId refers to their name) .
     * Not used yet.
     */
    let datasets = oa.datasets || (oa.datasets = {});
    /** Reference to all blocks by apName.
     * Not used yet.
     let blocks = oa.blocks || (oa.blocks = {});
     */



    /**  oa.axisIDs is an array, containing the block ID-s (i.e. chr names made
     *  unique by prepending their map name).
     * The array is not ordered; the stack order (left-to-right) is recorded by
     * the order of oa.stacks[].
     * This is all blocks, not just axesP (the parent / reference blocks).
     * @see service/data/blocks.js:viewed(), which can replace oa.axisIDs[].
     * @see stacks.axisIDs(), slight difference : blocks are added to
     * oa.axisIDs[] by receiveChr() before they are added to stacks;
     */
    dLog("oa.axisIDs", oa.axisIDs, source);
    /** axisIDs are <mapName>_<chromosomeName> */
    if ((source == 'dataReceived') || oa.axisIDs)
    {
      // append each element of myDataKeys[] to oa.axisIDs[] if not already present.
      // if (false)  // later limit it to axesP[], exclude blocks[]
      myDataKeys.forEach(function (axisID) { axisIDAdd(axisID); } );
    }
    else if ((myDataKeys.length > 0) || (oa.axisIDs === undefined))
      oa.axisIDs = myDataKeys;
    dLog("oa.axisIDs", oa.axisIDs);
    /** mapName (axisName) of each chromosome, indexed by chr name. */
    let cmName = oa.cmName || (oa.cmName = {});
    /** axis id of each chromosome, indexed by axis name. */
    let mapChr2Axis = oa.mapChr2Axis || (oa.mapChr2Axis = {});

    /** Plan for layout of stacked axes.

     graph : {chromosome{linkageGroup{}+}*}

     graph : >=0  chromosome-s layed out horizontally

     chromosome : >=1 linkageGroup-s layed out vertically:
     catenated, use all the space, split space equally by default,
     can adjust space assigned to each linkageGroup (thumb drag) 
     */



    //- moved to utils/draw/viewport.js : Viewport(), viewPort, graphDim, dragLimit
    let vc = oa.vc || (oa.vc = new Viewport());
    if (vc.count < 2)
    {
      console.log(oa, vc);
      vc.count++;
      vc.calc(oa);
      if (vc.count > 1)
      {
        /** could use equalFields(). */
        let
          widthChanged = oa.vc.viewPort.w != oa.vc.viewPortPrev.w,
        heightChanged = oa.vc.viewPort.h != oa.vc.viewPortPrev.h;
        // showResize() -> collateO() uses .o
        if (oa.svgContainer && oa.o)
          oa.showResize(widthChanged, heightChanged);
      }
      stacks.vc = vc; //- perhaps create vc earlier and pass vc to stacks.init()
    }
    if (! oa.axisTitleLayout)
      oa.axisTitleLayout = new AxisTitleLayout();

    let
      axisHeaderTextLen = vc.axisHeaderTextLen,
    margins = vc.margins,
    marginIndex = vc.marginIndex;
    let yRange = vc.yRange;

    if (oa.axes2d === undefined)
      oa.axes2d = new Axes(oa);

    let
    /** font-size of y axis ticks */
    axisFontSize = 12;
    /** default colour for paths; copied from app.css (.foreground path {
     * stroke: #808;}) so it can be returned from d3 stroke function.  Also
     * used currently to recognise features which are in colouredFeatures via
     * path_colour_scale(), which is a useful interim measure until scales are
     * set up for stroke-width of colouredFeatures, or better a class.
     */
    let pathColourDefault = "#808";

    //- moved to utils/draw/viewport.js : xDropOutDistance_update()


    /** When working with aliases: only show unique connections between features of adjacent Axes.
     * Features are unique within Axes, so this is always the case when there are no aliases.
     * Counting the connections (paths) between features based on aliases + direct connections,
     * if there is only 1 connection between a pair of features, i.e. the mapping between the Axes is 1:1,
     * then show the connection.
     *
     * Any truthy value of unique_1_1_mapping enables the above; special cases :
     * unique_1_1_mapping === 2 enables a basic form of uniqueness which is possibly not of interest
     * unique_1_1_mapping === 3 enables collateStacksA (asymmetric aliases).
     */
    let unique_1_1_mapping = 3;

    /** A simple mechanism for selecting a small percentage of the
     * physical maps, which are inconveniently large for debugging.
     * This will be replaced by the ability to request subsections of
     * chromosomes in API requests.
     */
    const filter_location = false;
    /** true means the <path> datum is the text of the SVG line, otherwise it is
     * the "ffaa" data and the "d" attr is the text of the SVG line.
     * @see featureNameOfPath().
     */
    let pathDataIsLine;
    /** true means the path datum is not used - its corresponding data is held in its parent g
     */
    const pathDataInG = true;

    /** Apply colours to the paths according to their feature name (datum); repeating ordinal scale.
     * meaning of values :
     *  set path_colour_domain to
     *   1 : features
     *   2 : d3.keys(aliasGroup)
     *  colour according to input from colouredFeatures; just the listed featureNames is coloured :
     *  each line of featureNames is         domain is
     *   3: featureName                      featureName-s
     *   4: scaffoldName\tfeatureName        scaffoldName-s
     *      scaffoldName can be generalised as class name.
     */
    let use_path_colour_scale = 4;
    let path_colour_scale_domain_set = false;


    //-	?
    /** export scaffolds and scaffoldFeatures for use in selected-features.hbs */
    let showScaffoldFeatures = this.get('showScaffoldFeatures');
    dLog("showScaffoldFeatures", showScaffoldFeatures);

    let showAsymmetricAliases = this.get('showAsymmetricAliases');
    dLog("showAsymmetricAliases", showAsymmetricAliases);

    /** Enable display of extra info in the path hover (@see hoverExtraText).
     * Currently a debugging / devel feature, will probably re-purpose to display metadata.
     */
    let showHoverExtraText = true;


    let svgContainer;

    let
      /** y[axisID] is the scale for axis axisID.
       * y[axisID] has range [0, yRange], i.e. as if the axis is not stacked.
       * g.axis-outer has a transform to position the axis within its stack, so this scale is used
       * for objects within g.axis-outer, and notably its child g.axis, such as the brush.
       * For objects in g.foreground, ys is the appropriate scale to use.
       */
      y = oa.y || (oa.y = {}),
    /** ys[axisID] is is the same as y[axisID], with added translation and scale
     * for the axis's current stacking (axis.position, axis.yOffset(), axis.portion).
     * See also comments for y re. the difference in uses of y and ys.
     */
    ys = oa.ys || (oa.ys = {}),
    /** scaled x value of each axis, indexed by axisIDs */
    o = oa.o || (oa.o = {}),
    /** Count features in Axes, to set stronger paths than normal when working
     * with small data sets during devel.  */
    featureTotal = 0,
    /** z[axisID] is a hash for axis axisID mapping feature name to location.
     * i.e. z[d.axis][d.feature] is the location of d.feature in d.axis.
     */
    z;  // was  = oa.z || (oa.z = myData);
    if (! oa.z)
      oa.blockFeatureLocation = oa.z = myData;
    else  // merge myData into oa.z
      d3.keys(myData).forEach(function (blockId) {
        if (! oa.z[blockId])
          oa.z[blockId] = myData[blockId];
      });
    z = oa.z;

    /** All feature names.
     * Initially a Set (to determine unique names), then converted to an array.
     */
    if (oa.d3FeatureSet === undefined)
      oa.d3FeatureSet = new Set();

    /** Index of features (markers) by object id. the value refers to the marker hash,
     * i.e. z[chr/ap/block name][feature/marker name] === featureIndex[feature/marker id] */
    oa.featureIndex || (oa.featureIndex = []);

    oa.selectedElements || (oa.selectedElements = this.get('selectedService.selectedElements'));


    if (source === 'didRender') {
      // when tasks are complete, receiveChr() is called via blockService : receivedBlock
    }
    else
      d3.keys(myData).forEach(function (axis) {
        /** axis is chr name */
        receiveChr(axis, myData[axis], source);
      });

    function redraw()
    {
      if (trace_dataflow > 1)
      {
        console.log("redraw", oa.axisIDs, oa.axes /*, oa.blocks*/);
        oa.stacks.log();
      }
      me.draw({}, 'dataReceived');
    }
    function receiveChr(axis, c, source) {
      let z = oa.z, cmName = oa.cmName;
      if ((z[axis] === undefined) || (cmName[axis] === undefined))
      {
        z[axis] = c;
        let dataset = c.dataset,
        datasetName = dataset && dataset.get('name'),
        parent = dataset && dataset.get('parent'),
        parentName = parent  && parent.get('name')
        ;
        if (oa.datasets[datasetName] === undefined)
        {
          oa.datasets[datasetName] = dataset;
          console.log(datasetName, dataset.get('_meta.shortName'));
        }
        cmName[axis] = {mapName : c.mapName, chrName : c.chrName
                        , parent: parentName
                        , name : c.name, range : c.range
                        , scope: c.scope, featureType: c.featureType
                        , dataset : dataset
                       };
        
        let mapChrName = makeMapChrName(c.mapName, c.chrName);
        mapChr2Axis[mapChrName] = axis;
        //-	receive 'add axisIDs'
        if (source == 'dataReceived')
        {
          axisIDAdd(axis);
        }
        delete c.mapName;
        delete c.chrName;
        if (trace_stack)
          dLog("receiveChr", axis, cmName[axis]);
        d3.keys(c).forEach(function(feature) {
          if (! isOtherField[feature]) {
            let f = z[axis][feature];
            // alternate filter, suited to physical maps : f.location > 2000000
            if ((featureTotal++ & 0x3) && filter_location)
              delete z[axis][feature];
            else
            {
              storeFeature(oa, flowsService, feature, f, undefined);
              /* could partition featureIndex by block name/id :
               * oa.featureIndex[axis][f.id] = f; but not necessary because object id
               * is unique. */

              // featureTotal++;

              /** This implementation of aliases was used initially.
               * The feature is simply duplicated (same location, same axis) for each alias.
               * This works, but loses the distinction between direct connections (same feature / gene)
               * and indirect (via aliases).
               */
              if (! unique_1_1_mapping)
              {
                let featureValue = z[axis][feature];
                if (featureValue && featureValue.aliases)
                  for (let a of featureValue.aliases)
                {
                    z[axis][a] = {location: featureValue.location};
                  }
              }
            }
          }
        });
      }
    }
    // hack a connection to receiveChr() until it gets moved / refactored.
    if (! this.get('receiveChr'))
      this.set('receiveChr', receiveChr);

    /** Check if axis exists in oa.axisIDs[].
     * @return index of axis in oa.axisIDs[], -1 if not found
     */
    function axisIDFind(axis) {
      let k;
      for (k=oa.axisIDs.length-1; (k>=0) && (oa.axisIDs[k] != axis); k--) { }
      return k;
    }
    /** If axis is not in oa.axisIDs[], then append it.
     * These 3 functions could be members of oa.axisIDs[] - maybe a class.
     */
    function axisIDAdd(axis) {
      if (axisIDFind(axis) < 0)
      {
        if (trace_stack)
          dLog("axisIDAdd push", oa.axisIDs, axis);
        oa.axisIDs.push(axis);
      }
    }
    /** Find axisName in oa.axisIDs, and remove it. */
    function deleteAxisfromAxisIDs(axisName)
    {
      let k = axisIDFind(axisName);
      if (k === -1)
        console.log("deleteAxisfromAxisIDs", "not found:", axisName);
      else
      {
        console.log("deleteAxisfromAxisIDs", axisName, k, oa.axisIDs);
        let a = oa.axisIDs.splice(k, 1);
        console.log(oa.axisIDs, "deleted:", a);
      }
    }

    /** Indexed by featureName, value is a Set of Axes in which the feature is present.
     * Currently featureName-s are unique, present in just one axis (Chromosome),
     * but it seems likely that ambiguity will arise, e.g. 2 assemblies of the same Chromosome.
     * Terminology :
     *   genetic map contains chromosomes with features;
     *   physical map (pseudo-molecule) contains genes
     */
    let featureAxisSets = flowsService.featureAxisSets;

    if (oa.drawOptions === undefined)
    {
      oa.drawOptions =
        {
          /** true enables display of info when mouse hovers over a path.
           * A subsequent iteration will show reduced hover info in a fixed location below the graph when false.
           */
          showPathHover : false,
          /** true enables display of info when mouse hovers over a brushed feature position (marked with a circle) on an axis.
           * A subsequent iteration will show reduced hover info in a fixed location below the graph when false.
           */
          showCircleHover : false,
          /** Draw a horizontal notch at the feature location on the axis,
           * when the feature is not in a axis of an adjacent Stack.
           * Makes the feature location visible, because otherwise there is no path to indicate it.
           */
          showAll : true,
          /** Show brushed features, i.e. pass them to updatedSelectedFeatures().
           * The purpose is to save processing time; this is toggled by 
           * setupToggleShowSelectedFeatures() - #checkbox-toggleShowSelectedFeatures.
           */
          showSelectedFeatures : true,

          controls : this.get('controls')

        };
    }

    /** Alias groups : aliasGroup[aliasGroupName] : [ feature ]    feature references axis and array of aliases */
    let aliasGroup = flowsService.aliasGroup;


    /** Map from feature names to axis names.
     * Compiled by collateFeatureMap() from z[], which is compiled from d3Data.
     */
    let featureToAxis = flowsService.featureToAxis;
    /** Map from feature names to axis names, via aliases of the feature.
     * Compiled by collateFeatureMap() from z[], which is compiled from d3Data.
     */
    let featureAliasToAxis = flowsService.featureAliasToAxis;

    // results of collateData()
    let
      /** axis / alias : feature    axisFeatureAliasToFeature[axis][feature alias] : [feature] */
      axisFeatureAliasToFeature = flowsService.axisFeatureAliasToFeature,
    /** axis/feature : alias groups       axisFeatureAliasGroups[axis][feature] : aliasGroup
     * absorbed into z[axis][feature].aliasGroupName
     axisFeatureAliasGroups = {},  */
    // results of collateMagm() - not used
    /** feature alias groups Axes;  featureAliasGroupAxes[featureName] is [stackIndex, a0, a1] */
    featureAliasGroupAxes = flowsService.featureAliasGroupAxes;

    /** class names assigned by colouredFeatures to alias groups, indexed by alias group name.
     * result of collateFeatureClasses().
     */
    let aliasGroupClasses = flowsService.aliasGroupClasses;

    // results of collateStacks1()
    let

      /** Not used yet; for pathAliasGroup().
       *  store : alias group : axis/feature - axis/feature   aliasGroupAxisFeatures[aliasGroup] : [feature, feature]  features have refn to parent axis
       * i.e. [aliasGroup] -> [feature0, a0, a1, za0[feature0], za1[feature0]] */
      aliasGroupAxisFeatures = flowsService.aliasGroupAxisFeatures;

    let
      line = d3.line(),
    foreground,
    // brushActives = [],
    /** guard against repeated drag event before previous dragged() has returned. */
    dragging = 0;
    /** trace scale of each axis just once after this is cleared.  enabled by trace_scale_y.  */
    let tracedAxisScale = {};


    /**
     * @return true if a is in the closed interval range[]
     * @param a value
     * @param range array of 2 values - limits of range.
     */
    function inRange(a, range)
    {
      return range[0] <= a && a <= range[1];
    }


    //- moved to ../utils/draw/axis.js :  eltId(), axisEltId(), highlightId()

    //- moved to ../utils/domElements.js :  eltClassName()

    //- moved to ../utils/domCalcs.js : checkIsNumber()

    /*------------------------------------------------------------------------*/
    //-    import { inRange } from "../utils/graph-maths.js";
    //-    import { } from "../utils/elementIds.js";

    function mapChrName2Axis(mapChrName)
    {
      let axisName = mapChr2Axis[mapChrName];
      return axisName;
    }
    /** @return chromosome name of axis id. */
    function axisName2Chr(axisName)
    {
      let c = oa.cmName[axisName];
      return c.chrName;
    }
    /** @return chromosome name of axis id, prefixed with mapName. */
    function axisName2MapChr(axisName)
    {
      let c = oa.cmName[axisName];
      return c && makeMapChrName(c.mapName, c.chrName);
    }
    function makeMapChrName(mapName, chrName)
    {
      return mapName + ':' + chrName;
    }
    function makeIntervalName(chrName, interval)
    {
      return chrName + "_" + interval[0] + "_" + interval[1];
    }
    //-    moved to "../utils/stacks-drag.js" : dragTransitionNew(), dragTransition(), dragTransitionEnd().

    /*------------------------------------------------------------------------*/
    //- moved to ../utils/domCalcs.js : round_2()
    /*------------------------------------------------------------------------*/
    /** These trace variables follow this pattern : 0 means no trace;
     * 1 means O(0) - constant size trace, i.e. just the array lengths, not the arrays.
     * further increments will trace the whole arrays, i.e. O(N),
     * and trace cross-products of arrays - O(N^2) e.g. trace the whole array for O(N) events.
     */
    const trace_scale_y = 0;
    const trace_drag = 0;
    //- moved to ../utils/draw/collate-paths.js : trace_alias, trace_adj
    const trace_path = 0;
    let trace_path_count = 0;
    const trace_path_colour = 0;
    let trace_synteny = 1;
    const trace_gui = 0;
    /*------------------------------------------------------------------------*/
    //- moved to utils/stacks.js

    /*------------------------------------------------------------------------*/

    //- moved to ../utils/flows.js : Flow()

    let flows;
    if ((flows = oa.flows) === undefined) // aka newRender
    {
      flows = oa.flows = flowsService.get('flows');
      // Continue to use oa for first version of split flows & paths, until replacement connections are established.
      if (oa && (flowsService.get('oa') === undefined))
        flowsService.set('oa', oa);
      flowsService.set('stackEvents', this);
    }


    //- moved to ../utils/draw/collate-paths.js : collateStacks()


    /*------------------------------------------------------------------------*/


    let pathFeatures = oa.pathFeatures || (oa.pathFeatures = {}); //For tool tip

    let selectedAxes = oa.selectedAxes || (oa.selectedAxes = []);;
    let selectedFeatures = oa.selectedFeatures || (oa.selectedFeatures = {});
    let brushedRegions = oa.brushedRegions || (oa.brushedRegions = {});

    /** planning to move selectedFeatures out to a separate class/component;
     * these 2 functions would be actions on it. */
    //Reset the selected Feature region, everytime an axis gets deleted
    function sendUpdatedSelectedFeatures()
    {
      if (oa.drawOptions.showSelectedFeatures)
        me.send('updatedSelectedFeatures', selectedFeatures);
    }
    function selectedFeatures_clear()
    {
      selectedFeatures = {};
      sendUpdatedSelectedFeatures();
    }
    /** When an axis is deleted, it is removed from selectedAxes and its features are removed from selectedFeatures.
     * Those features may be selected in another axis which is not deleted; in
     * which case they should not be deleted from selectedFeatures, but this is
     * quicker, and may be useful.
     * Possibly versions of the app did not update selectedAxes in some cases, e.g. when zooms are reset.
     */
    function selectedFeatures_removeAxis(axisName, mapChrName)
    {
      selectedAxes.removeObject(axisName);
      axisFeatureCircles_removeBlock(selectedFeatures, mapChrName);
      let p = mapChrName; // based on brushHelper()
      delete selectedFeatures[p];
    }
    /** @param blockS stacks Block */
    function selectedFeatures_removeBlock(blockS)
    {
      let
      mapChrName = blockS?.block?.brushName;
      axisFeatureCircles_removeBlock(selectedFeatures, mapChrName);
      /** axisFeatureCircles_removeBlock() uses selectedFeatures[mapChrName], so
       * call it before the following which filters that.  */
      if (selectedFeatures[mapChrName]) {
        selectedFeatures[mapChrName] = selectedFeatures[mapChrName]
          .filter((f) => f.get('blockId.id') !== blockS.block.id);
      }
    }

    collateData();

    /** For all Axes, store the x value of its axis, according to the current scale. */
    function collateO() {
      // if (me.isDestroying) { return; }
      dLog("collateO", oa.axisIDs.length, oa.stacks.axisIDs());
      oa.stacks.axisIDs().forEach(function(d){
        let o = oa.o;
        if (trace_stack > 1)
          console.log(d, axisId2Name(d), o[d], stacks.x(d));
        o[d] = stacks.x(d);
        checkIsNumber(oa.o[d]);
        if (o[d] === undefined) { breakPoint("collateO"); }
      });
      /** scaled x value of each axis, with its axisID. */
      let offsetArray = oa.stacks.axisIDs().map((d) => ({axisId : d, xOffset : oa.o[d]}));
      let previous = me.get('xOffsets'),
          changed = ! isEqual(previous, offsetArray);
      if (changed) {
        me.set('xOffsets', offsetArray);
        me.incrementProperty('xOffsetsChangeCount');
      }
    }
    /** Map an Array of Block-s to their longNames(), useful in log trace. */
    function Block_list_longName(blocks) {
      return blocks.map(function (b) { return b.longName(); });
    }
    let blocksToDraw = oa.axisIDs,
    viewedBlocks = me.get('blockService').get('viewedIds'),
    stackedBlocks = stacks.blockIDs(),
    blocksUnviewed = stackedBlocks.filter(function (blockId, i) {
      let foundAt = viewedBlocks.indexOf(blockId);
      return foundAt < 0;
    }),
    blocksToAdd = viewedBlocks.filter(function (axisName) {
      // axisName passes filter if it is not already in a stack
      return ! Stacked.getAxis(axisName) && (blocksToDraw.indexOf(axisName) == -1) ; });
    dLog(
      oa.stacks.axisIDs(), blocksToDraw.length, 'viewedBlocks', viewedBlocks,
      'blocksUnviewed', blocksUnviewed, 'blocksToAdd', blocksToAdd);
    if (blocksToAdd.length)
      blocksToDraw = blocksToDraw.concat(blocksToAdd);
    let duplicates = blocksToDraw.filter(function (v, i) { return blocksToDraw.indexOf(v, i+1) != -1; });
    if (duplicates.length)
      dLog/*breakPoint*/('duplicates', duplicates, blocksToDraw, blocksToAdd, oa.axisIDs);

    if ((oa.zoomBehavior === undefined) || instanceChanged)
    {
      /** default is 500.  "scaling applied in response to a WheelEvent ... is
       * proportional to 2 ^ result of wheelDelta(). */
      let wheelDeltaFactor = 500 * 3 * 8;
      dLog('wheelDeltaFactor', wheelDeltaFactor);
      function wheelDelta() {
        return -d3.event.deltaY * (d3.event.deltaMode ? 120 : 1) / wheelDeltaFactor;
      }
      function zoomFilter(d) {
        let  e = d3.event;
        let  include;
        /** WheelEvent is a subtype of MouseEvent; click to drag axis gets
         * MouseEvent - this is filtered out here so it will be handle by dragged().
         * ! d3.event.button is the default zoom.filter, possibly superfluous here.
         */
        let isMouseWheel = (d3.event instanceof WheelEvent) && ! d3.event.button;
        if (isMouseWheel) {

          if (e.shiftKey && trace_stack > 1) {
            dLog('zoom.filter shiftKey', this, arguments, d3.event, d);
          }

          let axisName = d,
          axis = oa.axesP[axisName];

          if ((y[axisName] !== axis.y) || (oa.ys[axisName] !== axis.ys))
            dLog('zoomFilter verify y', axisName, axis, oa);
          if (axis.axisName !== d)
            dLog('zoomFilter verify axisName', axisName, axis);

          include = wheelNewDomain(axis, oa.axisApi, true); // uses d3.event
        }
        return include;
      }

      oa.zoomBehavior = d3.zoom()
        .filter(zoomFilter)
        .wheelDelta(wheelDelta)
      /* use scaleExtent() to limit the max zoom (zoom in); the min zoom (zoom
       * out) is limited by wheelNewDomain() : axisReferenceDomain, so no
       * minimum scaleExtent is given (0).
       * scaleExtent() constrains the result of transform.k * 2^wheelData( ),
       */
        .scaleExtent([0, 1e8])
        .on('zoom', zoom)
      ;
      // console.log('zoomBehavior', oa.zoomBehavior);
    }


    /* may have parent and child blocks in the same axis becoming unviewed in
     * the same run-loop cycle, so ensure that the children are unviewed
     * before the parents.
     */
    [true, false].forEach(function (filterChildren) {
      /** Accumulate child data blocks whose parent is being unviewed;
       * these will be unviewed before the parents.
       */
      let orphaned = [];
      /** filter the generation indicated by filterChildren */
      let     generationBlocksUnviewed = blocksUnviewed.filter(function (blockId, i) {
        let b = oa.stacks.blocks[blockId],
        /** These 2 criteria should be equivalent (i.e. isParent == ! isChild);
         * the focus here is on unviewing the non-reference blocks of an axis
         * before the reference block, so isParent is used.
         * isChild says that the block is eligible to be a child; (it is possible,
         * but seems very unlikely, that the block may have just been added and
         * would be adopted below.)
         * Child blocks have .parent and may have namespace; parent blocks don't have namespace.
         */
        isParent = b.axis && (b === b.axis.blocks[0]), // equivalent to b.axis.referenceBlock.view,
        features = b.block.get('features'),
        isChild = (b.parent || b.block.get('namespace') || (features && features.length));
        if (isParent == isChild)        // verification.
          breakPoint(b.longName(), isParent, 'should be !=', isChild, b.axis, features);
        if (filterChildren && isParent)
        {
          let add = b.axis.dataBlocks(false, false).filter(function (b) { return b.block.get('isViewed'); });
          if (add.length)
            console.log(b.longName(), 'add to orphaned :', Block_list_longName(add));
          orphaned = orphaned.concat(add);
        }
        return filterChildren == ! isParent;
      });
      dLog('filterChildren', filterChildren, generationBlocksUnviewed);
      if (filterChildren && orphaned.length) {
        let orphanedIds = orphaned.map(function (b) { return b.axisName; });
        console.log('orphaned', Block_list_longName(orphaned), orphanedIds);
        generationBlocksUnviewed = generationBlocksUnviewed.concat(orphanedIds);
      }
      generationBlocksUnviewed.forEach(function (blockId) {
        blockIsUnviewed(blockId);
      });
    });

    /** Add the block to z[].
     * based on receivedBlock().
     */
    function receivedBlock2(block) {
      let retHash = {},
      ch = block,
      blockId = block.get('id'), // chr
      rc = chrData(ch);
      /** use same structure as routes/mapview.js */
      retHash[blockId] = rc;
      this.get('receiveChr')(blockId, rc, 'dataReceived');
    }

    // Place new data blocks in an existing or new axis.
    if (false)
      blocksToDraw.forEach(function(d){
        ensureAxis(d);
      });

    if (! oa.axisApi.ensureAxis)
      oa.axisApi.ensureAxis = ensureAxis;
    // for (let d in oa.stacks.axes) {
    /** ensure that d is shown in an axis & stack.
     * @return axis (Stacked)
     */
    function ensureAxis(d) {
      /** dBlock should be !== undefined.
       */
      let dBlock = me.peekBlock(d),
      sBlock = oa.stacks.blocks[d],
      addedBlock = ! sBlock;

      if (! oa.z[dBlock.id])
        receivedBlock2.apply(me, [dBlock]);


      if (! sBlock || ! dBlock.get('view')) {
        /** sBlock may already be associated with dBlock */
        let view = dBlock.get('view');
        sBlock = view || new Block(dBlock);
        // if view, then this is already set.
        if (oa.stacks.blocks[d] !== sBlock)
          oa.stacks.blocks[d] = sBlock;
        if (! view) {
          /* this .set() was getting assertion fail (https://github.com/emberjs/ember.js/issues/13948),
           * hence the catch and trace;  this has been resolved by not displaying .view in .hbs
           */
          try {
            dBlock.set('view', sBlock);
            dBlock.set('visible', sBlock.visible);
          }
          catch (exc) {
            console.log('ensureAxis', d, dBlock, sBlock, addedBlock, view, oa.stacks.blocks, exc.stack || exc);
          }
        }
      }
      let s = Stacked.getStack(d);
      if (trace_stack > 1)
        console.log(d, dBlock, 'sBlock', sBlock, s);
      /* verification
       if (addedBlock == (s !== undefined))
       breakPoint(d, 'addedBlock', addedBlock, sBlock, 'already in stack', s); */
      if (s && ! dBlock.get('view'))
        console.log(d, 'has stack', s, 'but no axis', dBlock);
      if (s && (s.axes.length == 0))
      {
        let axis = sBlock.axis;
        dLog('re-add to stack', d, s, axis);
        sBlock.log();
        s.log();
        axis.log();
        s.add(axis);
        oa.stacks.axesP[d] = axis;
        if (oa.stacks.indexOf(s) == -1)
          oa.stacks.append(s);
        axisIDAdd(d);
        s.log();
      }
      else
        // if axisID d does not exist in stacks[], add a new stack for it.
        if (! s)
      {
          let zd = oa.z[d],
          dataset = zd ? zd.dataset : dBlock.get('datasetId'),
          /** parent.parent may now be defined, in which case that will be the
           * axis owner, not parent.  Further note below re. parent.parent (QTLs)
           */
          parent = dataset && dataset.get('parent'),
          parentName = parent && parent.get('name'),  // e.g. "myGenome"
          parentId = parent && parent.get('id'),  // same as name
          namespace = dataset && dataset.get('namespace'),
          /** undefined or axis of parent block of d. */
          parentAxis
          ;
          Stack.verify();

          console.log(d, "zd", zd, dataset && dataset.get('name'), parent, parentName, parentId, namespace);
          // zd.  scope, featureType, , namespace
          // if block has a parent, find a block with name matching parentName, and matching scope.
          if (parentName)
          {
            /** this is alternative to matchParentAndScope() - direct lookup. */
            let parentDataset = oa.datasets[parentName];
            dLog("dataset", parentName, parentDataset);
            function matchParentAndScope (key, value) {
              if (! zd)
                zd = oa.z[d];
              let block = oa.z[key],
              /** block is a copy of the data attributes, it does not have
               * block.store; block_ is the ember data store object. */
              block_ = me.peekBlock(key),
              /** Match scope, dataset parent name, and store.name.
               * There may be a copy of the parent in >1 server; for now we'll
               * put the data block on the axis of the parent from the same
               * server.  It is not invalid to put it on a different server,
               * and that functionality can be considered.
               * Now replacing :
               *  (dBlock.store.name === block_.store.name)
               * with parentMatch (which probably covers match and could replace it)
               * And sometimes dataset (z[d].dataset) is the local dataset with
               * the same name instead of dBlock.get('datasetId').dBlock
               * So adding parentNameMatch, and using b.get('referenceBlock') as fall-back;
               * this will be replaced anyway (axesBlocks, which uses block.referenceBlock).
               */
              parentMatch = block_ && (block_.get('datasetId.content') === dataset.get('parent')),
              parentNameMatch = block_ && (dataset.get('parentName') === get(block_, 'datasetId.id')),
              match = (block.scope == zd.scope) && (block.dataset.get('name') == parentName);
              dLog(key, trace_stack ? block : block.dataset.get('name'), match, parentMatch, parentNameMatch);
              match = match && (parentMatch || parentNameMatch);
              return match;
            }

            let blockName;
            /** Adding support for QTLs whose parent is a marker set aligned to
             * a physical reference means we now may have dataset.parent.parent,
             * i.e. dBlock.parentBlock !== dBlock.referenceBlock, whereas
             * matchParentAndScope() assumes that the parentBlock is the owner of
             * the axis (the referenceBlock).  This is handled here as a special
             * case; it is likely useReferenceBlock() can now replace
             * matchParentAndScope().
             */
             if (dBlock.get('datasetId.parent.parent')) {
               useReferenceBlock(dBlock);
             }
            if (! blockName) {
              /** undefined if no parent found, otherwise is the id corresponding to parentName */
              blockName = d3.keys(oa.z).find(matchParentAndScope);
            }
            if (! blockName) {
              let b = me.peekBlock(d);
              useReferenceBlock(b);
            }
            function useReferenceBlock(b) {
              let
              r = b && b.get('referenceBlock');
              blockName = r && r.get('id');
              dLog(d, b, 'referenceBlock', r, blockName);
            }
            dLog(parentName, blockName);
            if (blockName)
            {
              let block = oa.z[blockName];
              parentAxis = oa.axesP[blockName];
              if (! block) {
                dLog('ensureAxis', blockName, oa.z, oa.axesP);
              } else {
                dLog(block.scope, block.featureType, block.dataset.get('name'), block.dataset.get('namespace'), "parentAxis", parentAxis);
              }
            }
          }

          let sd;
          /** if any children loaded before this, adopt them */
          let adopt;
          /** Use the stack of the first child to adopt.
           * First draft created a new stack, this may transition better.
           */
          let adopt0;

          /** if true then if child data blocks are received before their parent
           * blocks, create an axis and stack for the child block, and when the
           * parent arrives, re-assign the axis to the parent, adopting the child
           * into the axis.
           *
           * The idea was to give the user some positive feedback if the child
           * data arrived and not the parent block, but the updates involved in
           * the adoption step may be a problem, so this is currently disabled.
           */
          const drawChildBlocksBeforeParent = false;
          
          if (! drawChildBlocksBeforeParent && parentName && ! parentAxis)
          {
            dLog(sd, ".parentName", parentName);
            sBlock.parentName = parentName;
            sBlock.z = oa.z[d];
            /* Skip the remainder of the function, which implements the
             * drawChildBlocksBeforeParent feature.
             * Disabling adoption seems to avoid this error, which is probably
             * caused by an axis-1d component being destroyed during adoption :
             *  "Cannot update watchers for `domain` on `<... component:draw/axis-1d ...>` after it has been destroyed."
             *
             * This return can be re-structured to if/then, assuming this solution works.
             */
            return;
          }


          if (! parentAxis)
          {
            // initial stacking : 1 axis per stack, but later when db contains Linkage
            // Groups, can automatically stack Axes.
            /* It seems better to re-use oa.axesP[adopt0] instead of creating sd;
             * that requires the adoption search to be done earlier, which is simple,
             * and also will change this significantly, so is better deferred
             * until after current release.
             */
            sd = new Stacked(d, 1); // parentAxis === undefined
            sd.referenceBlock = dBlock;
            dLog('before push sd', sd, sd.blocks, sBlock);
            sd.logBlocks();
            if (sd.blocks.length && sd.blocks[0] === sBlock)
              breakPoint('sBlock already in sd.blocks', sd.blocks);
            else
            {
              sd.blocks.push(sBlock);
              dLog('after push', sd.blocks);
              sd.logBlocks();
            }
            // .parent of referenceBlock is undefined.
            sBlock.setAxis(sd);
            if (sBlock !== sd.referenceBlockS())
              dLog('sBlock', sBlock, ' !== sd.referenceBlockS()',  sd.referenceBlockS());

            adopt = 
              d3.keys(oa.axesP).filter(function (d2) {
                let a = oa.stacks.blocks[d2]; //  could traverse just axesP[] and get their reference
                let match = 
                  (d != d2) &&  // not self
                  ! a.parent && a.parentName && (a.parentName == dataset.get('name')) &&
                  a.z.scope && (a.z.scope == oa.cmName[d].scope) &&
                  (a.block.store.name === dataset.store.name);
                if (! a.parent && trace_stack > 1)
                {
                  console.log(d2, a.parentName,  dataset.get('name'),
                              a.z && a.z.scope,  oa.cmName[d].scope, match); 
                }
                return match;
              });

            if (adopt.length)
            {
              dLog("adopt", adopt);
              adopt0 = adopt.shift();
              let a = oa.axesP[adopt0];
              a.stack.log();
              /** stacks:Block of the block being adopted */
              let aBlock = a.referenceBlockS();
              sd.move(a, 0);

              delete oa.axesP[adopt0];
              deleteAxisfromAxisIDs(adopt0);
              a.stack.remove(adopt0);
              // roughly equivalent : a.stack.move(adopt0, newStack, -1)

              // a.axisName = d;
              // sd.blocks[0] is sBlock
              dLog('aBlock.parent', aBlock.parent, '->', sd.blocks[0]);
              aBlock.parent = sd.blocks[0];
              dLog('aBlock.axis', aBlock.axis, sd);
              // see comments re. axislater and run.later in @see Block.prototype.setAxis().
              aBlock.setAxis(sd);
              a.stack.add(sd);
              dLog(adopt0, a, sd, oa.axesP[a.axisName]);
              sd.stack.log();

              sd.scale = a.scale;
              /** the y scales will be accessed via the new name d. - also update domain */
              dLog('adopt scale', y[d] && 'defined', y[adopt0] && 'defined');
              if (y[d] === undefined)
                y[d] = y[adopt0]; // could then delete y[adopt0]

              /** change the axisID of the DOM elements of the axis which is being adopted.  */
              let aStackS = oa.svgContainer.select("g.axis-outer#" + eltId(adopt0));
              dLog('aStackS', aStackS.size());
              aStackS
                .datum(d)
                .attr("id", eltId);
              if (trace_stack > 1)
              {
                logSelection(aStackS);
                logSelectionNodes(aStackS);
              }

              let gAll = 
                aStackS.select("g.axis-all")
                .attr("id", eltIdAll);

              /** just the <text> which is immediate child of gAll;  could use selectImmediateChildNodes(gAll).
               */
              let axisTitleS = aStackS.select("g.axis-all > text");
              axisTitleFamily(axisTitleS);

              /** update the __data__ of those elements which refer to axis parent block name */
              let dataS = aStackS.selectAll("g.brush, g.brush > g[clip-path], g.stackDropTarget, g.stackDropTarget > rect");
              /* could also update adopt0 -> d in : 
               *  g.brush > clipPath#axis-clip-${axisID}
               *  g.brush > g[clip-path] url(#axis-clip-${axisID})
               * but adopt0 is unique and that is all that is required for now;
               * will likely change datum of g axis* and brush to the Stacked axis
               * when splitting out axes from draw-map, simplifying adoption.
               */
              dLog('dataS', dataS.nodes(), dataS.data(), '->', d);
              dataS.each(function () { d3.select(this).datum(d); });

              let gAxisS = aStackS.selectAll("g.axis");
              dLog('zoomBehavior adopt.length', adopt.length, gAxisS.nodes(), gAxisS.node());
              gAxisS
                .datum(d)
                .attr('id', axisEltId(d))
                .call(oa.zoomBehavior)
                .call(axis.scale(y[d]));

              if (trace_stack > 1)
              {
                let checkS = aStackS.selectAll("g, g.stackDropTarget > rect");
                checkS.each(function(b,i) {console.log(this,b,i,b.__data__); } );
                // logSelectionNodes(checkS);
              }
            }
          }

          // verification : sd is defined iff this block doesn't have a parent axis and is not adopting a block with an axis.
          if ((sd !== undefined) != ((parentAxis || adopt0) === undefined))
            dLog('sd', sd, parentAxis, adopt0);
          let
            /** blocks which have a parent axis do not need a Stack.
             * sd is defined if we need a new axis and hence a new Stack.
             */
            newStack = sd && ! adopt0 && new Stack(sd);
          if (parentAxis)
          {
            dLog("pre-adopt", parentAxis, d, parentName);
            /* axisIDAdd() has already been called (by receiveChr() or from
             * myDataKeys above), so remove d from axisIDs because it is a child
             * data block, not an axis / reference block.
             * Alternative is to use stacks.axisIDs(); splitting out axes as a
             * component will replace oa.axisIDs.
             */
            deleteAxisfromAxisIDs(d);
            delete oa.axesP[d];
            dLog('before push parentAxis', parentAxis, parentAxis.blocks, sBlock);
            parentAxis.logBlocks();
            parentAxis.blocks.push(sBlock);
            dLog('after push', parentAxis.blocks);
            parentAxis.logBlocks();
            sBlock.setAxis(parentAxis);
            sBlock.parent = parentAxis.referenceBlockS();
            let aStackS1 = oa.svgContainer.select("g.axis-outer#" + eltId(parentAxis.axisName));
            let axisTitleS = aStackS1.select("g.axis-all > text");
            axisTitleFamily(axisTitleS);
          }
          else if (! adopt0)
          {
            /** handle GM-s and reference.
             * : when reference arrives before any children : no .parent.
             * Difference : GM has namespace and features;  reference has range
             */
            let isReference = dBlock.get('range') !== undefined;
            // if (! isReference)
            /* GM has no parent/child separation; it is its own reference and data block.  */
            // set above : sd.referenceBlock = dBlock;
            // sBlock.parent = sd;   //-	.parent should be Block not Stacked
            // could push() - seems neater to place the reference block first.
            dLog('before unshift sd', sd, sd.blocks, sBlock);
            if (sd.blocks.length && sd.blocks[0] === sBlock)
              dLog('sBlock already in sd.blocks', sd.blocks);
            else
            {
              if (trace_stack)
                sd.logBlocks();
              sd.blocks.unshift(sBlock);
              dLog('after unshift', sd.blocks);
              if (trace_stack)
                sd.logBlocks();
            }
          }
          /** to recognise parent when it arrives.
           * not need when parentAxis is defined.
           */
          if (parentName && ! parentAxis)
          {
            console.log(sd, ".parentName", parentName);
            sBlock.parentName = parentName;
          }
          if (sBlock) { sBlock.z = oa.z[d]; }
          if (sd)
            sd.z = oa.z[d];  // reference from Stacked axis to z[axisID]

          // newStack is only defined if sd is defined (and !adopt0) which is only true if ! parentAxis
          if (newStack)
          {
            console.log("oa.stacks.append(stack)", d, newStack.stackID, oa.stacks);
            oa.stacks.append(newStack);
            console.log(oa.stacks);
            newStack.calculatePositions();
          }

          if (! parentAxis)
          {
            adopt.map(function (d3) {
              /** axis being adopted.
               * a is discarded, and a.blocks[0] is re-used.
               */
              let a = oa.axesP[d3];
              /** oldStack will be deleted. `a` will become unreferenced. */
              let oldStack = a.stack;

              /** re-use the Block being adopted. */
              let aBlock = a.referenceBlockS();
              sd.move(a, 0);
              // could set .parent in .move()
              aBlock.parent = sd;
              //	-	check that oldStack.delete() will delete the (Stacked) a

              console.log(d3, a, aBlock, sd, oa.axesP[a.axisName]);
              sd.stack.log();
              // noting that d3 == a.axisName
              delete oa.axesP[a.axisName];
              oa.stacks.blocks[a.axisName] = aBlock;
              console.log('aBlock.axis', aBlock.axis);
              aBlock.axis = sd;
              deleteAxisfromAxisIDs(a.axisName);
              if (! oldStack)
                console.log("adopted axis had no stack", a, a.axisName, oa.stacks);
              else
              {
                // remove Stack of a from oa.stacks.  a.stack is already replaced.
                console.log("remove Stack", oldStack, oa.stacks);
                oldStack.delete();
                console.log("removed Stack", oa.stacks, oa.stacks.length, a);
              }
            });
          }
          Stack.verify();
          stacksAxesDomVerify(stacks, oa.svgContainer);
        }
    }

    stacksAxesDomVerify(stacks, oa.svgContainer);
    /**  add width change to the x translation of axes to the right of this one.
     */
    function axisWidthResizeRight(axisID, width, dx)
    {
      console.log("axisWidthResizeRight", axisID, width, dx);
      /** this is like Stack.axisStackIndex().  */
      let axis = oa.axes[axisID], from = axis.stack,
      fromSix = from.stackIndex(),   o = oa.o;
      for (let six=0; six < stacks.length; six++)
      {
        let stack = stacks[six],
        /** apply the dx proportionally to the closeness of the stack to the cursor (e.g. stack index or x distance),
         * and apply it -ve to those to the left, including the stack of the axis extend being resized, so that it mirrors,
         * i.e. right side goes same distance as dx, left side same and opposite,
         */
        close =
          (six == fromSix)
          ? -1/2
          : (six < fromSix)
          ? (six - fromSix) / fromSix
          : (six - fromSix) / (stacks.length - fromSix);
        console.log("close", close, fromSix, six, stacks.length);
        stack.axes.forEach(
          function (a, index)
          {
            o[a.axisName] += (dx * close);
          }
        );
        // could filter the selection - just those right of the extended axis
        oa.svgContainer.selectAll(".axis-outer").attr("transform", Stack.prototype.axisTransformO);
        stack.axes.forEach( function (a, index) { axisRedrawText(oa.axes[a.axisName]); });
        pathUpdate(undefined);
      }
    };
    function updateXScale()
    {
      // xScale() uses stacks.keys().
      oa.xScaleExtend = xScaleExtend(); // or xScale();
    }
    let x = stacks.x;
    updateXScale();
    //let dynamic = d3.scaleLinear().domain([0,1000]).range([0,1000]);
    //console.log(axis.scale(y[axisIDs))
    //- stacks_for_axisIDs(); //- added during split

    //- moved to utils/stacks.js: oa.xScaleExtend = xScale();

    collateO();
    vc.xDropOutDistance_update(oa);

    //- moved updateRange() to utils/stacksLayout

    //-    import { } from "../utils/paths.js";

    //-    import { } from "../utils/intervals.js";

    var path_colour_scale;
    let featureScaffold = oa.featureScaffold || (oa.featureScaffold = {}),
    scaffolds = new Set(), scaffoldFeatures = {};
    let intervals = {}, intervalNames = new Set(), intervalTree = {};
    //-scaffolds
    /** scaffoldTicks[axisID] is a set of y locations, relative to the y axis of axisID, of horizontal tick marks.
     * General purpose; first use is for scaffold edges.
     */
    let scaffoldTicks =  oa.scaffoldTicks || (oa.scaffoldTicks = {});
    //-sb
    /** syntenyBlocks is an array, each element defines a synteny block which
     * can be seen as a parallelogram connecting 2 axes (Axes); the range on each
     * axis is defined by 2 gene names.
     * This is a simple form for input via the content-editable; the result from the BE API may be factored to :
     { chr1, chr2,
     [
     [ gene1, gene2, gene3, gene4, optional_extra_data],
     ...
     ]
     }, ...
     *
     * (the genes could instead be features on a genetic map, but the planned use of
     * synteny block display is physical maps / genes).
     */
    let syntenyBlocks =  oa.syntenyBlocks || (oa.syntenyBlocks = []);
    //- paths-classes
    if (use_path_colour_scale)
    {
      let path_colour_domain;
      switch (use_path_colour_scale)
      {
      case 1 : path_colour_domain = oa.features; break;
      case 2 : path_colour_domain = d3.keys(oa.aliasGroup); break;
      default:
      case 4:
      case 3 : path_colour_domain = ["unused"];
        this.set('colouredFeaturesChanged', function(colouredFeatures_) {
          console.log('colouredFeatures changed, length : ', colouredFeatures_.length);
          let val;
          if ((colouredFeatures_.length !== 0) &&
              ((val = getUsePatchColour()) !== undefined))
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
                let col=featureNames[i].split(/[ \t]+/),
                scaffoldName = col[0], featureName = col[1];
                featureScaffold[featureName] = scaffoldName;
                // for the tooltip, maybe not required.
                if (scaffoldFeatures[scaffoldName] === undefined)
                  scaffoldFeatures[scaffoldName] = [];
                scaffoldFeatures[scaffoldName].push(featureName);
                scaffolds.add(scaffoldName);
              }
              collateFeatureClasses(featureScaffold);
              if (showScaffoldFeatures !== me.get('showScaffoldFeatures'))
              {
                showScaffoldFeatures = me.get('showScaffoldFeatures');
                console.log("showScaffoldFeatures", showScaffoldFeatures);
              }
              if (showScaffoldFeatures)
              {
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
                let col=featureNames[i].split(/[ \t]+/),
                mapChrName = col[0], interval = [col[1], col[2]];
                let axisName = mapChrName2Axis(mapChrName);
                if (intervals[axisName] === undefined)
                  intervals[axisName] = [];
                intervals[axisName].push(interval);
                let intervalName = makeIntervalName(mapChrName, [col[1], + col[2]]);
                intervalNames.add(intervalName);
              }
              d3.keys(intervals).forEach(function (axisName) {
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
                let col=featureNames[i].split(/[ \t]+/),
                mapChrName = col[0], tickLocation = col[1];
                let axisName = mapChrName2Axis(mapChrName);
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
                  let mapChr2Axis = cols[j], axisName = mapChrName2Axis(mapChr2Axis);
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
              showSynteny(syntenyBlocks, undefined);
            }
            else if (trace_path_colour > 2)
              console.log("use_path_colour_scale", use_path_colour_scale);

            pathColourUpdate(undefined, undefined);
            scaffoldLegendColourUpdate();
          }
        });
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

    //- moved to utils/draw/axis.js : maybeFlip(), maybeFlipExtent()

    //-components/stacks 
    /* for each axis :
     * calculate its domain if not already done; 
     * ensure it has a y scale,
     *   make a copy of the y scale - use 1 for the brush
     */
    oa.stacks.axisIDs().forEach(function(d) {
      let a = oa.axes[d];
      // now a is Stacked not Block, so expect ! a.parent
      if (a.parent && ! a.parent.getDomain)
        breakPoint('domain and ys', d, a, a.parent);
      let
        /** similar domain calcs in resetZoom().  */
        domain = a.parent ? a.parent.getDomain() : a.getDomain();
      if (false)      //  original, replaced by domainCalc().
      {
        /** Find the max of locations of all features of axis name d. */
        let yDomainMax = d3.max(Object.keys(oa.z[d]), function(a) { return oa.z[d][a].location; } );
        domain = [0, yDomainMax];
      }
      let myRange = a.yRange(), ys = oa.ys, y = oa.y;
      if (ys[d])  // equivalent to (y[d]==true), y[d] and ys[d] are created together
      {
        if (trace_stack > 1)
          console.log("ys exists", d, ys[d].domain(), y[d].domain(), ys[d].range());
      }
      else if (domain)
      {
        ys[d] = d3.scaleLinear()
          .domain(maybeFlip(domain, a.flipped))
          .range([0, myRange]); // set scales for each axis
        
        //console.log("OOO " + y[d].domain);
        // y and ys are the same until the axis is stacked.
        // The brush is on y.
        y[d] = ys[d].copy();
        y[d].brush = d3.brushY()
          .extent([[-8,0],[8,myRange]])
          .filter(combineFilters(noKeyfilter, me.controlsService.noGuiModeFilter))
          .on("end", brushended);
      }
    });
    /** when draw( , 'dataReceived'), pathUpdate() is not valid until ys is updated.
     * ysUpdated is roughly equivalent to ysLength(), but on entry to a new
     * draw() closure, ysUpdated is undefined until this point, while oa.ys
     * contains existing axis scales.
     */
    let ysUpdated = true;
    function ysLength()
    {
      return oa && oa.ys && d3.keys(oa.ys).length;
    }

    let svgRoot;
    /** Diverting to the login component removes #holder and hence <svg>, so
     * check if oa.svgRoot refers to a DOM element which has been removed. */
    let newRender = ((svgRoot = oa.svgRoot) === undefined)
      ||  (oa.svgRoot.node().getRootNode() !== window.document);
    if (newRender)
    {
      if (oa.svgRoot)
        console.log('newRender old svgRoot', oa.svgRoot.node(), oa.svgContainer.node(), oa.foreground.node());
      
      // Use class in selector to avoid removing logo, which is SVG.
      d3.select("svg.FeatureMapViewer").remove();
      d3.select("div.d3-tip").remove();
    }
    let translateTransform = "translate(" + margins[marginIndex.left] + "," + margins[marginIndex.top] + ")";
    if (newRender)
    {
      let graphDim = oa.vc.graphDim;
      oa.svgRoot = 
        svgRoot = d3.select('#holder').append('svg')
        .attr("class", "FeatureMapViewer")
        .attr("viewBox", oa.vc.viewBox.bind(oa.vc))
        .attr("preserveAspectRatio", "none"/*"xMinYMin meet"*/)
        .attr('width', "100%" /*graphDim.w*/)
        .attr('height', graphDim.h /*"auto"*/);
      oa.svgContainer =
        svgContainer = svgRoot
        .append("svg:g")
        .attr("transform", translateTransform);

      stacks.dragTransition = new DragTransition(oa.svgContainer);

      console.log(oa.svgRoot.node(), '.on(resize', this.resize);

      let resizeThis =
        // this.resize.bind(oa);
        function(transition) {
          if (trace_stack)
            dLog("resizeThis", transition);
          debounce(oa, me.resize, [transition], 500);
        };
      /** d3 dispatch.on() does not take arguments, and similarly for eltWidthResizable() param resized. */
      function resizeThisWithTransition() { resizeThis(true); }
      function resizeThisWithoutTransition() { resizeThis(false); }

      // This detects window resize, caused by min-/max-imise/full-screen.
      if (true)
        d3.select(window)
        .on('resize', resizeThisWithTransition);
      else  // also works, can drop if further testing doesn't indicate one is better.
        $( window )
        .resize(function(e) {
          console.log("window resize", e);
          // see notes in domElements.js regarding  .resize() debounce
          debounce(resizeThisWithTransition, 300);
        });

      /* 2 callbacks on window resize, register in the (reverse) order that they
       * need to be called (reorganise this).
       * Revert .resizable flex-grow before Viewport().calc() so the latter gets the new size.  */
      eltWidthResizable('.resizable', undefined, resizeThisWithoutTransition);
    }
    else
      svgContainer = oa.svgContainer;

    let options = this.get('urlOptions');

    function setCssVariable(name, value)
    {
      oa.svgRoot.style(name, value);
    }

    //- moved to ../utils/draw/collate-paths.js : countPaths(), countPathsWithData()

    //User shortcut from the keybroad to manipulate the Axes
    d3.select("#holder").on("keydown", function() {
      if ((String.fromCharCode(d3.event.keyCode)) == "D") {
        console.log("Delete axis (not implemented)");
        // deleteAxis();
      }
      else if ((String.fromCharCode(d3.event.keyCode)) == "Z") {
        zoomAxis();
      }
      else if ((String.fromCharCode(d3.event.keyCode)) == "R") {
        refreshAxis();
      }
      else if ((String.fromCharCode(d3.event.keyCode)) == "A") {
        /* replaced by tickOrPath === 'tick' or 'path' */
        oa.drawOptions.showAll = !oa.drawOptions.showAll;
        console.log("showAll", oa.drawOptions.showAll);
        refreshAxis();
      }
      else if ((String.fromCharCode(d3.event.keyCode)) == " ") {
        console.log("space");
      }
    });

    //- paths
    //Add foreground lines.
    /** pathData is the data of .foreground > g > g, not .foreground > g > g > path */

    /** Determine class name of path or g, @see pathDataInG.
     * Value is currently just concatenation of names of endpoint features, could be aliasGroupName.
     * If Flow.direct then use I for pathClass, otherwise pathClassA()
     */
    function pathClassA(d)
    { let d0=d[0], d1=d[1], c = d1 && (d1 != d0) ? d0 + "_" + d1: d0;
      return c; }
    /**  If unique_1_1_mapping then path data is ffaa, i.e. [feature0, feature1, a0, a1]
     */
    function featureNameOfData(da)
    {
      let featureName = (da.length === 4)  // i.e. ffaa (enabled by unique_1_1_mapping)
        ? da[0]  //  ffaa, i.e. [feature0, feature1, a0, a1]
        : da;
      return featureName;
    }
    /** @see also pathsUnique_log()  */
    function data_text(da)
    {
      return unique_1_1_mapping   // ! flow.direct
        ? [da[0], da[1], da[2].mapName, da[3].mapName]
        : da;
    }

    function flowName(flow)
    {
      return flow.name;
    }
    function flowHidden(flow)
    {
      let hidden = ! flow.visible;
      return hidden;
    }

    // if (oa.foreground && newRender), oa.foreground has been removed; commented above.
    if (((foreground = oa.foreground) === undefined) || newRender)
    {
      oa.foreground =
        foreground = oa.svgContainer.append("g") // foreground has as elements "paths" that correspond to features
        .attr("class", "foreground");
      let flowValues = d3.values(flows),
      flowsg = oa.foreground.selectAll("g")
        .data(flowValues)
        .enter()
        .append("g")
        .attr("class", flowName)
        .classed("hidden", flowHidden)
        .each(function (flow, i, g) {
          /** separate attributes g and .gf, the latter for paths collated in frontend */
          flow.gf = d3.select(this);
          /* related : drawGroupContainer() and updateSelections_flowControls() */
          if (! flow.g) {
            flow.g = d3.select();
          }
        })
      ;
    }
    
    // pathUpdate(undefined);
    stacks.log();

    //-components/stacks
    // Add a group element for each stack.
    // Stacks contain 1 or more Axes.
    /** selection of stacks */
    let stackSd = oa.svgContainer.selectAll(".stack")
      .data(stacks, Stack.prototype.keyFunction),
    stackS = stackSd
      .enter()
      .append("g"),
    stackX = stackSd.exit();
    if (trace_stack)
    {
      console.log("append g.stack", stackS.size(), stackSd.exit().size(), stackS.node(), stackS.nodes());
      if (oa.stacks.length > stackSd.size() + stackS.size())
      {
        console.log("missed stack", oa.stacks.length, stackSd.size());
        breakPoint();
      }
    }
    let removedStacks = 
      stackX;
    if (removedStacks.size())
    {
      if (trace_stack > 1)
      {
        logSelection(removedStacks);
        logSelectionNodes(removedStacks);
      }
      console.log('removedStacks', removedStacks.size());
      /** If there are g.axis-outer in removedStacks[], either move them to the
       * correct g.stack or remove them.
       *
       * Generation of the stacks / axes will probably be simpler when converted
       * to CP -> d3 join;   probably can still get the move transition for the
       * g.axis-outer by doing .insert() of the g.axis-outer in the .exit() case
       * of the g.stack.
       */
      let ra = removedStacks.selectAll("g.axis-outer");
      console.log('ra', ra, ra.nodes(), ra.node());
      ra.each(function (d, i, g) {
        console.log(d, i, this);
        let rag = this,
        ras = Stacked.getStack(d), sDest, alreadyAxis;
        if (! ras)
        {
          // this is OK - just information
          console.log('removedStacks', 'axis no longer in a stack', d);
        }
        else
          if (! (sDest = ras && oa.svgContainer.select("g.stack#" + eltId(ras.stackID)))
              || sDest.empty()) {
            dLog('removedStacks', 'No stack for axis', ras, ras.stackID, this);
          }
        else
          // check that target is not parent
          // if it is then no move required.
          if (sDest.node() === this.parentElement) {
            dLog('removedStacks', 'axis is already in the right parent', d, i, ras, this.parentElement);
          }
        // check if there is already a g.axis-outer with this id in that stack.
        else if ((alreadyAxis = sDest.selectAll("g > g.axis-outer#id" + rag.__data__)) && ! alreadyAxis.empty()) {
          dLog('removedStacks', 'axis is already in the right parent', rag.__data__, d, i, ras, sDest.node(), this.parentElement);
          // rag is not needed and will be removed with its parent which is in removedStacks[] / stackX
        }
        else
        {
          console.log('to stack', ras.stackID, sDest.node());
          let
            /** .insert() will change .__data__, refn d3 doc : " Each new
             * element inherits the data of the current elements, if any, in
             * the same manner as selection.select."
             * Data of parent g.stack is Stack; data of g.axis-outer is axisID
             */
            ragd = rag.__data__,
          moved = sDest.insert(function () { return rag; });
          rag.__data__ = ragd;
          if (trace_stack > 1)
          {
            console.log(moved.node(), moved.data(), moved.node().parentElement,
                        rag.__data__);
            Stack.verify();
            stacksAxesDomVerify(stacks, oa.svgContainer);
          }
        }
      });
      console.log('remnant', removedStacks.node());
    }
    stackX
      .transition().duration(500)
      .remove();

    /*
     let st = newRender ? stackS :
     stackS.transition().duration(dragTransitionTime);
     let stackS_ = st
     */
    stackS
      .attr("class", "stack")
      .attr("id", stackEltId);

    function stackEltId(s)
    { if (s.stackID === undefined) breakPoint();
      dLog("stackEltId", s.stackID, s.axes[0].mapName, s);
      return eltId(s.stackID); }

    /** For the given Stack, return its axisIDs.
     * @return [] containing string IDs of reference blocks of axes of the Stack.
     */
    function stack_axisIDs(stack)
    {
      let result = stack.parentAxisIDs();
      if (trace_stack > 1)
        dLog('stack_axisIDs', stack, result);
      return result;
    }

    if (stackS && trace_stack >= 1.5)
      logSelection(stackS);

    // Add a group element for each axis.
    // Stacks are selection groups in the result of this .selectAll()
    let axisS =
      stackSd.merge(stackS)
      .selectAll(".axis-outer"),
    /**
     * @param d1	axisID (blockId)
     * @param this	EnterNode
     */
    moveOrAdd = function (d1, i, g) {
      let p = g[0]._parent,
      r;
      let gaExists = d3.selectAll("g.axis-outer#id" + d1);
      if (gaExists.size()) {
        r = gaExists.node();
        dLog('gaExists', gaExists.nodes(), r, p);
      }
      else {
        r = d3.creator('g').apply(this, [d1, i, g]);
      }
      return r;
    },
    axisG = axisS
      .data(stack_axisIDs, Stacked.prototype.keyFunction)
      .enter().append(moveOrAdd /*'g'*/),
    axisX = axisS.exit();
    dLog('stacks.length', stacks.length, axisG.size(), axisX.size());
    axisG.each(function(d, i, g) { dLog(d, i, this); });
    axisX.each(function(d, i, g) { dLog('axisX', d, i, this); });
    axisX.remove();
    let axisGE = axisG
      .selectAll('g.axis-all')
      .data((d) => [d])
      .enter(),
    /** filter axisG down to those elements without a g.axis-all child.
     * This would be equivalent to those elements of axisG which are parents in
     * the .enter() set axisGE, i.e. axisGE.nodes().mapBy('_parent')
     */
    axisGempty = 
      axisG.filter( function (d) { return d3.select(this).selectAll('g > g.axis-all').empty(); }),
    allG = axisGE
      .append('g')
      .attr("class", "axis-all")
      .attr("id", eltIdAll);
    // following code appends sub-elements to axisG, so use axisGempty.
    axisG = axisGempty;
    if (axisG.size())
      dLog(allG.nodes(), allG.node());


    if (trace_stack)
    {
      if (trace_stack > 1)
        oa.stacks.forEach(function(s){console.log(s.axisIDs());});
      let g = axisG;
      console.log("g.axis-outer", g.enter().size(), g.exit().size(), stacks.length);
    }
    axisG
      .attr("class", "axis-outer")
      .attr("id", eltId);
    let g = axisG;
    /** stackS / axisG / g / gt is the newly added stack & axis.
     * The X position of all stacks is affected by this addition, so
     * re-apply the X transform of all stacks / axes, not just the new axis.
     */
    let ao =
      svgContainer.selectAll('.axis-outer');  // equiv: 'g.stack > g'
    /** apply the transform with a transition if changing an existing drawing. */
    let gt = newRender ? ao :
      ao.transition().duration(dragTransitionTime);
    if (trace_stack > 2)
    {
      console.log('.axis-outer');
      logSelectionNodes(gt);
    }
    /* could be used to verify ao selection. */
    if (trace_stack > 3)
    {
      let ga =  selectImmediateChildNodes(svgContainer);
      console.log('svgContainer > g');
      logSelectionNodes(ga);
      let ao1 = svgContainer.selectAll("g.stack > g");  //.axis-outer
      logSelectionNodes(ao1);
    }
    Stack.verify();
    stacksAxesDomVerify(stacks, oa.svgContainer, /*unviewedIsOK*/ true);
    ao
      .attr("transform", Stack.prototype.axisTransformO);
    g
      .call(
        d3.drag()
          .subject(function(d) { return {x: oa.stacks.x(d)}; }) //origin replaced by subject
          .filter(ctrlKeyfilter)
          .on("start", dragstarted) //start instead of dragstart in v4. 
          .on("drag", dragged)
          .on("end", dragended));//function(d) { dragend(d); d3.event.sourceEvent.stopPropagation(); }))
    if (g && trace_stack >= 1.5)
      logSelection(g);

    //-components/axis
    /*------------------------------------------------------------------------*/
    /** the DropTarget which the cursor is in, recorded via mouseover/out events
     * on the DropTarget-s.  While dragging this is used to know the DropTarget
     * into which the cursor is dragged.
     */
    // oa.currentDropTarget /*= undefined*/;

    function DropTarget() {
      let viewPort = oa.vc.viewPort;
      let size = {
        /** Avoid overlap, assuming about 5-7 stacks. */
        w : Math.round(Math.min(axisHeaderTextLen, viewPort.w/15)),
        // height of dropTarget at the end of an axis
        h : Math.min(80, viewPort.h/10),
        // height of dropTarget covering the adjacent ends of two stacked axes
        h2 : Math.min(80, viewPort.h/10) * 2 /* + axis gap */
      },
      posn = {
        X : Math.round(size.w/2),
        Y : /*YMargin*/10 + size.h
      },
      /** top and bottom edges relative to the axis's transform.
       */
      edge = {
        top : size.h,
        /** Originally bottom() depended on the axis's portion, but now g.axis-outer
         * has a transform with translate and scale which apply the axis's portion
         * to the elements within g.axis-outer.
         * So bottom() is now based on vc.yRange instead of axis.yRange().
         * @param axis is not used - see comment re. edge.
         */
        bottom : function (axis) { return vc.yRange /* formerly axis.yRange() */ - size.h; }
      };
      /** Same as dropTargetY().
       * Called via d3 .attr().
       * @param this  <rect> DOM element in g.stackDropTarget
       */
      function dropTargetYresize () {
        /** DOMTokenList. contains top or bottom etc */
        let rect = this,
        parentClasses = rect.parentElement.classList,
        top = parentClasses.contains('top'),
        bottom = parentClasses.contains('bottom'),
        yVal = top ? -oa.vc.dropTargetYMargin : edge.bottom(undefined);
        // console.log('dropTargetYresize', rect, parentClasses, top, bottom, yVal);
        return yVal;
      };

      /** @return axis which this DropTarget is part of */
      DropTarget.prototype.getAxis = function ()
      {
        /** The datum of the DropTarget is the axisName */
        let axisName = this.datum(),
        axis = oa.axes[axisName];
        return axis;
      };
      /// @parameter top  true or false to indicate zone is positioned at top or
      /// bottom of axis
      /// uses g, a selection <g> of all Axes
      DropTarget.prototype.add = function (top)
      {
        // Add a target zone for axis stacking drag&drop
        let stackDropTarget = 
          g.append("g")
          .attr("class", "stackDropTarget" + " end " + (top ? "top" : "bottom"));
        let
          dropTargetY = function (datum/*, index, group*/) {
            let axisName = datum,
            axis = oa.axes[axisName],
            yVal = top ? -oa.vc.dropTargetYMargin : edge.bottom(axis);
            if (Number.isNaN(yVal))
            {
              console.log("dropTargetY", datum, axis, top, oa.vc.dropTargetYMargin, edge.bottom(axis));
              breakPoint();
            }
            return yVal;
          };
        stackDropTarget
          .append("rect")
          .attr("x", -posn.X)
          .attr("y", dropTargetY)
          .attr("width", 2 * posn.X)
          .attr("height", posn.Y)
        ;

        stackDropTarget
          .on("mouseover", dropTargetMouseOver)
          .on("mouseout", dropTargetMouseOut);
      };

      /** The original design included a drop zone near the middle of the axis,
       * for dropping an axis out of its current stack; this is replaced by
       * dropping past xDropOutDistance, so this is not enabled.
       * @parameter left  true or false to indicate zone is positioned at left or
       * right of axis
       */
      DropTarget.prototype.addMiddle = function (left)
      {
        // Add a target zone for axis stacking drag&drop
        let stackDropTarget = 
          g.append("g")
          .attr("class", "stackDropTarget" + " middle " + (left ? "left" : "right"));
        function dropTargetHeight(datum/*, index, group*/)
        {
          // console.log("dropTargetHeight", datum, index, group);
          /** dropTargetHeight is axis height minus the height of the top and bottom drop zones.
           * Translate and scale is provided by transform of g.axis-outer, so
           * use vc yRange not axis.yRange().  More detailed comment in @see edge.bottom().
           * So axis is not used :
           let axisName = datum,
           axis = oa.axes[axisName];
           */
          return vc.yRange - 2 * size.h;
        }
        stackDropTarget
          .append("rect")
          .attr("x", left ? -1 * (oa.vc.dropTargetXMargin + posn.X) : oa.vc.dropTargetXMargin )
          .attr("y", edge.top)
          .attr("width", posn.X /*- oa.vc.dropTargetXMargin*/)
          .attr("height", dropTargetHeight)
        ;

        stackDropTarget
          .on("mouseover", dropTargetMouseOver)
          .on("mouseout", dropTargetMouseOut);
      };

      /** Show the affect of window resize on axis drop target zones.
       * Only the y value of g.top > rect elements need be changed.
       * Target zone width could be changed in response to window width change - that is not done.
       */
      DropTarget.prototype.showResize = function ()
      {
        oa.svgContainer.selectAll('g.stackDropTarget.bottom > rect')
          .attr("y", dropTargetYresize)
        // .each(function(d, i, g) { console.log(d, i, this); })
        ;
      };

      function storeDropTarget(axisName, classList)
      {
        oa.currentDropTarget = {axisName: axisName, classList: classList};
      }

      function dropTargetMouseOver(data, index, group){
        console.log("dropTargetMouseOver() ", this, data, index, group);
        this.classList.add("dragHover");
        storeDropTarget(data, this.classList);
      }
      function dropTargetMouseOut(d){
        console.log("dropTargetMouseOut", d);
        this.classList.remove("dragHover");
        oa.currentDropTarget = undefined;
      }

    }
    let dropTarget = new DropTarget();

    [true, false].forEach(function (i) {
      dropTarget.add(i);
      // dropTarget.addMiddle(i);
    });


    /** from newly added g.axis-all : filter out those which have a parent which draws their axis. */
    g = allG
      .filter(function (d) { return oa.axesP[d]; } )
    ;
    if (trace_stack > 1)
    {
      console.log(oa.axesP, "filter", g.size(), allG.size());
      logSelection(g);
    }

    // Add an axis and title
    /** This g is referenced by the <use>. It contains axis path, ticks, title text, brush. */
    let defG =
      g.append("g")
      .attr("class", "axis")
      .each(function(d) {
        let axis = Stacked.getAxis(d);
        d3.select(this).attr("id",axisEltId(d)).call(axis.axisSide(y[d])); });  

    function axisTitle(chrID)
    {
      let cn=oa.
        cmName[chrID];
      // console.log(".axis text", chrID, cn);
      return cn.mapName + " " + cn.chrName;
    }

    let axisTitleS = g.append("text")
       /* id is used by axis-menu targetId */
      .attr('id', axisEltIdTitle)
      .attr("y", -2 * axisFontSize)
      .style("font-size", axisFontSize);
    axisTitleFamily(axisTitleS);
    /** true if any axes have children.  used to get extra Y space at top for multi-level axis title.
     * later can calculate this, roughly : oa.stacks.axesP.reduce(function (haveChildren, a) { return haveChildren || oa.stacks.axesP[a].blocks.length; } )
     * The maximum value of that can be used as the value of Viewport:calc(): axisNameRows.
     */
    let someAxesHaveChildBlocks = true;

    if (! oa.axisApi.axisTitleFamily)
      oa.axisApi.axisTitleFamily = axisTitleFamily;
    /** Update the axis title, including the block sub-titles.
     * If ! axisTitle_dataBlocks, don't show the data block sub-titles, only the first line;
     * this is selected in axisName2Blocks().
     *
     * From the number of block sub-titles, calculate 'y' : move title up to
     * allow for more block sub-titles.
     * Create / update a <tspan> for each block, including the parent / reference block.
     * Configure a hover menu for each <tspan>, either axis (parent) or subtitle (data block).
     *
     * @param axisTitleS  d3 selection of the <text> within g.axis-all
     * In usage, axisTitleS is a selection of either a single axis, or all axes.
     */
    function axisTitleFamily(axisTitleS) {
      if (axisTitle_dataBlocks) {
      axisTitleS
      // .text(axisTitle /*String*/)
      // shift upwards if >1 line of text
        .each(function (d) {
          let axis = Stacked.getAxis(d),
          length = axis && axis.blocks.length;
          if (length && length > 1)
          {
            /** -2 * axisFontSize is the default for a single row. */
            let y = '-' + (length+1) * (1.3 * axisFontSize);
            d3.select(this)
              .attr('y', y + 'px');
          }
        })
      ;
      }



      let apiServers = me.get('apiServers');
      let axisTitleBlocksServers = new AxisTitleBlocksServers(oa.svgContainer, oa.axisTitleLayout, apiServers);
      let subTitleS =
    axisTitleS.selectAll("tspan.blockTitle")
      /** @return type Block[]. blocks of axisName.
       * first block is parent, remainder are data (non-reference) */
        .data(axisName2Blocks, (block) => block.getId()),
      subTitleE = subTitleS
      .enter()
      .append("tspan")
      .attr('class', 'blockTitle');
      if (axisTitle_dataBlocks) {
      subTitleE.each(AxisTitleBlocksServers.prototype.prependTspan);
      }
      subTitleS.exit()
        // .each(AxisTitleBlocksServers.prototype.remove1)  // enable if axisTitle_dataBlocks
        .remove();
      let subTitleM =
      subTitleE.merge(subTitleS)
        .text(function (block) { return block.titleText(); })
        .attr('x', '0px')
        /* The tspan.blockServer is only displayed when there are multiple api servers.
         * If the tspan.blockServer was not rendered, then this (tspan.blockTitle) should have the dy.
         * It is simpler to hide/show tspan.blockServer with css rather than
         * re-render when the number of api servers changes, but to produce a
         * clean svg export for publication it may be worth doing that.
         * .attr('dy',  function (d, i) { return "" + (i ? 1.5 : 0)  + "em"; })
         */
        .style('stroke', Block.axisTitleColour)
        .style('fill', Block.axisTitleColour)
        .style('opacity', function (block, i) { return (i > 0) && ! block.visible ? 0.5 : undefined; } )
        .each(function (block, i) {
          /** until ae114cf5, distinct menus were offered for the reference
           * block (first line of title) and the data blocks (subsequent lines).
           * Now each line has onclick for the same menu (showMenu -> axis-menu).
           * So this could be changed to use a single listener, on the parent <text>.
           */
          let menuFn = true // (i == 0)
            ? configureAxisTitleMenu
            : configureAxisSubTitleMenu;
          menuFn.apply(this, arguments);
          /* register blockUnview() and blockVisible() in menuActions.  */
          menuActions_block();
        });

      if (axisTitle_dataBlocks) {
        axisTitleS.call(AxisTitleBlocksServers.prototype.render.bind(axisTitleBlocksServers));
      }
    };

    function axisName2Blocks (axisName) {
      let axis = Stacked.getAxis(axisName);
      // equiv : axis.children(true, false)
      return axis ? (axisTitle_dataBlocks ? axis.blocks : [axis.blocks[0]]) : [];
    }


    function updateAxisTitles()
    {
      let axisTitleS = oa.svgContainer.selectAll("g.axis-all > text");
      axisTitleFamily(axisTitleS);
    }

    /** Called when the width available to each axis changes,
     * i.e. when collateO() is called.
     * Calculate the size and layout of axis titles.
     * Based on that layout, apply text-anchor and transform to the <text>,
     * and adjust svg viewBox and padding-top.
     * @param axisTitleS  d3 selection of g.axis-all, for one or more axes;
     * if undefined then g.axis-all is selected for all axes.
     */
    function updateAxisTitleSize(axisTitleS)
    {
      if (! stacks.length)
        return;
      if (! axisTitleS)
        axisTitleS = oa.svgContainer.selectAll("g.axis-all")
        .transition().duration(dragTransitionTime)
      ;

      oa.vc.calc(oa);
      // vc.calc() calculates .axisXRange, which is used here.
      console.log('vc.axisXRange', vc.axisXRange, axisTitleS.nodes(), stacks.length);
    let axisXRange = vc.axisXRange;
      /** axisXRange[] already allows for 1/2 title space either side, so use length-1.
       * stacks.length is > 0 here */
      let nStackAdjs = stacks.length > 1 ? stacks.length-1 : 1;
    let axisSpacing = (axisXRange[1]-axisXRange[0])/nStackAdjs;
    let titleLength = Block.titleTextMax(),
      /** char width in px, ie. convert em to px.  Approx -	better to measure this. */
      em2Px = 7,
      titlePx = titleLength ? titleLength * em2Px : 0;
    let titleText = vc.titleText || (vc.titleText = {});

      oa.vc.axisHeaderTextLen = titlePx;
      oa.axisTitleLayout.calc(axisSpacing, titlePx);


      // applied to all axes consistently, not just appended axis.
      // Update elements' class and transform when verticalTitle changes value.

      // also incorporate extendedWidth() / getAxisExtendedWidth() in the
      // calculation, perhaps integrated in xScaleExtend()
      let axisTitleA =
        axisTitleS.selectAll("g.axis-all > text");
      axisTitleA
        // this attr does not change, can be done for just axisG
        .style("text-anchor", oa.axisTitleLayout.verticalTitle ? "start" : undefined)
        .attr("transform", yAxisTitleTransform(oa.axisTitleLayout));

      let t =
      oa.svgRoot
        .transition().duration(dragTransitionTime)
        .attr("viewBox", oa.vc.viewBox.bind(oa.vc))
      ;

      if (axisTitle_dataBlocks) {
      let axisTitleBlocksServers = new AxisTitleBlocksServers(oa.svgContainer, oa.axisTitleLayout, me.get('apiServers'));
      t.on('end', () => axisTitleBlocksServers.position(axisTitleS));
      }

      /** showZoomResetButtonXPosn() is called in axis-1d and axis-2d,
       * ideally the call will be only in axis-1d, but for now this
       * picks up some cases not covered.  */
      let 
      axisIds = axisTitleS.nodes().mapBy('__data__'),
      axes1 = axisIds.map((axisId) => oa.axes[axisId]);
      axes1.forEach(
        (a) => a && a.axis1d && bind(a.axis1d, a.axis1d.showZoomResetButtonXPosn)());
    }
    updateAxisTitleSize(axisG.merge(axisS));

//- moved to ../utils/draw/axis.js : yAxisTextScale(),  yAxisTicksScale(),  yAxisBtnScale()

    // Add a brush for each axis.
    let gBrushParent =
    allG.append("g")
      .attr("class", "brush");
    /** Ensure there is clipPath & rect in gBrushParent, and set its geometry. */
    function brushClipSize(gBrushParent) {
      gBrushParent
      .each(function(axisID) {
        brushClip(d3.select(this), axisID)
          .each(function(d) { d3.select(this).call(oa.y[d].brush); });
      });
    }
    /** brushClip() uses getBBox(), so call again after the geometry has settled.
     * If this works reliably, it might suggest splitting the append(clipPath)
     * from the geometry setting.
     * The 2sec call should be fine for most computers, some might take until
     * 5sec to settle the geometry.
     */
    brushClipSize(gBrushParent);
    later(() => ! me.isDestroying && brushClipSize(gBrushParent), 2000);
    later(() => ! me.isDestroying && brushClipSize(gBrushParent), 5000);


    if (allG.nodes().length)
      console.log('zoomBehavior', allG.nodes(), allG.node());
    allG
      .call(oa.zoomBehavior);

    /*------------------------------------------------------------------------*/
    /* above is the setup of scales, stacks, axis */
    /* stacksAdjust() calls pathUpdate() which depends on the axis y scales. */
    if (source == 'dataReceived')
      stacks.changed = 0x10;
    let t = stacksAdjust(true, undefined);
    /* below is the setup of path hover (path classes, colouring are setup
     * above, but that can be moved following this, when split out). */
    /*------------------------------------------------------------------------*/

    // Setup the path hover tool tip.
    let toolTipCreated = ! oa.toolTip;
    let toolTip = oa.toolTip || (oa.toolTip =
      d3.tip()
        .attr("class", "toolTip d3-tip")
        .attr("id","toolTip")
    );
    if (toolTipCreated)
    {
      me.ensureValue("toolTipCreated", true);
    }
    toolTip.offset([-15,0]);
    svgRoot.call(toolTip);


    //Probably leave the delete function to Ember
    //function deleteAxis(){
    //  console.log("Delete");
    //}

    /** remove g#axisName
     */
    function removeAxis(axisName, t)
    {
      let axisS = oa.svgContainer.select("g.axis-outer#" + eltId(axisName));
      console.log("removeAxis", axisName, axisS.empty(), axisS.node());
      axisS.remove();
    }
    /** remove g.stack#id<stackID
     */
    function removeStack(stackID, t)
    {
      let stackS = oa.svgContainer.select("g.stack#" + eltId(stackID));
      console.log("removeStack", stackID, stackS.empty(), stackS.node());
      stackS.remove();
    }
    /** remove axis, and if it was only child, the parent stack;  pathUpdate
     * @param stackID -1 (result of .removeStacked) or id of stack to remove
     * @param stack refn to stack - if not being removed, redraw it
     */
    function removeAxisMaybeStack(axisName, stackID, stack)
    {
      let t = oa.svgContainer.transition().duration(750);
      removeAxis(axisName, t);
      /** number of stacks is changing */
      let changedNum = stackID != -1;
      if (changedNum)
      {
        removeStack(stackID, t);
      }
      else
      {
        console.log("removeAxisMaybeStack", axisName, stackID, stack);
        if (stack)
          stack.redraw(t);
      }
      stacks.changed = 0x10;
      /* Parts of stacksAdjust() are applicable to the 2 cases above : either a
       * stack is removed, or a stack is non-empty after an axis is removed from
       * it.  This is selected by changedNum.
       *
       * stacksAdjust() calls redrawAdjacencies() (when changedNum) for all
       * stacks, but only need it for the stacks on either side of the removed
       * stack.
       */
      stacksAdjust(changedNum, t);
    }
    /** Called when an axis and/or stack has change position.
     * This can affect Axis positions, and because data is filtered by the
     * current adjacencies, the displayed data.
     * Update the drawing to reflect those changes.
     * @param t undefined or transition to use for d3 element updates.
     */
    function axisStackChanged_(t)
    {
      showTickLocations(oa.scaffoldTicks, t);
      if (oa.syntenyBlocks) {
        /** time for the axis positions to update */
        later(() => ! me.isDestroying && showSynteny(oa.syntenyBlocks, t), 500);
      }

      me.trigger('axisStackChanged', t);
    }
    function axisStackChanged(t)
    {
      throttle(this, axisStackChanged_, [t], 500);
    }

//-components/paths
    //d3.selectAll(".foreground > g > g").selectAll("path")
    /* (Don, 2017Mar03) my reading of handleMouse{Over,Out}() is that they are
     * intended only for the paths connecting features in adjacent Axes, not
     * e.g. the path in the y axis. So I have narrowed the selector to exclude
     * the axis path.  More exactly, these are the paths to include and exclude,
     * respectively :
     *   svgContainer > g.foreground > g.flowName > g.<featureName> >  path
     *   svgContainer > g.stack > g.axis-outer > g.axis#<axisEltId(axisName)> > path    (axisEltId() prepends "a"))
     * (axisName is e.g. 58b504ef5230723e534cd35c_MyChr).
     * This matters because axis path does not have data (observed issue : a
     * call to handleMouseOver() with d===null; reproduced by brushing a region
     * on an axis then moving cursor over that axis).
     */
    setupMouseHover(
      d3.selectAll(".foreground > g > g > path")
    );

    /** Setup the functions handleMouse{Over,Out}() on events mouse{over,out}
     * on elements in the given selection.
     * The selected path elements are assumed to have __data__ which is either
     * sLine (svg line text) which identifies the hover text, or ffaa data
     * which enables hover text to be calculated.
     * @param pathSelection	<path> elements
     */
    function setupMouseHover(pathSelection)
    {
      pathSelection
        .on("mouseover",handleMouseOver)
        .on("mouseout",handleMouseOut);
    }

    function toolTipMouseOver()
    {
      let toolTipHovered = me.get('toolTipHovered') ;
      console.log("toolTipMouseOver", toolTipHovered);
      if (! toolTipHovered)
        me.set('toolTipHovered', true);
    }
    function toolTipMouseOut()
    {
      let toolTipHovered = me.get('toolTipHovered') ;
      console.log("toolTipMouseOut", toolTipHovered);
      if (toolTipHovered)
        me.set('toolTipHovered', false);
      hidePathHoverToolTip();
    }
    function closeToolTip() 
    {
      console.log("draw-map closeToolTip");
      me.ensureValue('toolTipHovered', false);
      hidePathHoverToolTip();
    }
    if (this.actions.closeToolTipA === undefined)
    {
      this.actions.closeToolTipA = closeToolTip;
    }
    function setupToolTipMouseHover()
    {
      // may need to set toolTipHovered if toolTip already contains cursor when it is shown - will toolTipMouseOver() occur ?.
      // me.ensureValue('toolTipHovered', true);

      d3.select("div.toolTip.d3-tip#toolTip")
        .on("mouseover", toolTipMouseOver)
        .on("mouseout", toolTipMouseOut);

      $("div.toolTip.d3-tip#toolTip button#toolTipClose")
        .on("click", closeToolTip);
    }


    /**
     * @param d   SVG path data string of path
     * @param this  path element
     */
    function handleMouseOver(d, i){
      let sLine, pathFeaturesHash;
      let pathFeatures = oa.pathFeatures;
      let hoverFeatures;
      /** d is either sLine (pathDataIsLine===true) or array ffaa. */
      let pathDataIsLine = typeof(d) === "string";
      // don't interrupt dragging with pathHover
      if (Stack.currentDrag || ! oa.drawOptions.showPathHover)
        return;
      if (pathDataIsLine)
      {
        pathFeaturesHash = pathFeatures[d];
        hoverFeatures = Object.keys(pathFeaturesHash);
        console.log("hoverFeatures 1", hoverFeatures);
      }
      else
      {
        sLine = this.getAttribute("d");
        pathFeaturesHash = pathFeatures[sLine];
        if ((pathFeaturesHash === undefined) && ! pathDataIsLine)
        {
          let ffaa = dataOfPath(this),
          [feature0, feature1, a0, a1] = ffaa;
          let direction, aliasGroupName;
          if (ffaa.length == 6)
          {
            direction = ffaa[4];
            aliasGroupName = ffaa[5];
          }
          let z = oa.z;
          pathFeatureStore(sLine, feature0, feature1, z[a0.axisName][feature0], z[a1.axisName][feature1], aliasGroupName);
          pathFeaturesHash = pathFeatures[sLine];
        }
        // can also append the list of aliases of the 2 features
        hoverFeatures = Object.keys(pathFeaturesHash)
          .reduce(function(all, a){
            // console.log(all, a, a.split(','));
            return  all.concat(a.split(","));
          }, []);
        console.log("hoverFeatures 2,3", hoverFeatures);
      }
      /** pathClasses uses this datum instead of d.  */
      let classSet = pathClasses(this, d), classSetText;
      if (classSet)
      {
        if (typeof classSet == "string")
        {
          console.log(this, d, classSet, classSetText);
          classSetText = "<br />" + classSet;
        }
        else if (classSet.size && classSet.size > 0)
        {
          classSet.forEach(function (className) {
            console.log(className);
            classSetText = "<br />" + className;
          });
        }
      }

      // console.log(d, featureNameOfData(d), sLine, pathFeaturesHash);
      let listFeatures  = "";
      // stroke attributes of this are changed via css rule for path.hovered
      d3.select(this)
        .classed("hovered", true);
      Object.keys(pathFeaturesHash).map(function(a){
        let hoverExtraText = pathFeaturesHash[a];
        if (hoverExtraText === 1) hoverExtraText = "";
        else if (classSetText) hoverExtraText += classSetText;
        listFeatures = listFeatures + a + hoverExtraText + "<br />";
      });

      let hoveredPath = this;
      toolTip.offset(function() {
        return [hoveredPath.getBBox().height / 2, 0];
      });

      /** If path-hover currently exists in toolTip, avoid insert error by detaching it while updating html of parent toolTip */
      let
        pt=$('.toolTip.d3-tip#toolTip'),
      ph = pt.find('.pathHover');
      console.log(pt[0], "pathHover:", ph[0] || ph.length);
      if (ph.length)
      {
        console.log("pathHover detaching");
      }
      let
        ph1=ph.detach();

      listFeatures += '\n<button id="toolTipClose">&#x2573;</button>\n'; // ╳
      toolTip.html(listFeatures);

      toolTip.show(d, i);
      let ph2=ph1.appendTo(pt);
      once(me, function() {
        let ph3= $('.pathHover');
        console.log(".pathHover", ph2[0] || ph2.length, ph3[0] || ph3.length);
        me.set("hoverFeatures", hoverFeatures);
        // me.ensureValue("pathHovered", true);
        me.trigger("pathHovered", true, hoverFeatures);
      });
      later(me, function() {
        setupToolTipMouseHover();
      }, 1000);
    }

    function hidePathHoverToolTip() {
      console.log("hidePathHoverToolTip", me.get('toolTipHovered'));
      debounce(me, function () {
      if (! me.get('toolTipHovered'))
      {
        toolTip.hide();
        // me.ensureValue("pathHovered", false);
        me.trigger("pathHovered", false);
      }
      }, 1000);
    }

    function handleMouseOut(d){
      // stroke attributes of this revert to default, as hover ends
      d3.select(this)
        .classed("hovered", false);
      debounce(me, hidePathHoverToolTip, 2000);
    }

//- axis

    function zoomAxis(){
      console.log("Zoom : zoomAxis()");
    }
    function refreshAxis(){
      console.log("Refresh");
    }

    /*------------------------------------------------------------------------*/
    /** Draw horizontal ticks on the axes, representing scaffold boundaries.
     * @param t transition or undefined
     */
    function showTickLocations(scaffoldTicks, t)
    {
      d3.keys(scaffoldTicks).forEach
      (function(axisName)
       {
         let tickLocations = Array.from(scaffoldTicks[axisName].keys());
         /** -  if axisName matches nothing, then skip this. */
        let aS = d3.select("#" + axisEltId(axisName));
        if (!aS.empty())
        {
          let pS = aS.selectAll("path.horizTick")
             .data(tickLocations),
             pSE = pS.enter()
             .append("path")
            .attr("class", "horizTick fromInput");
          pSE
            .each(configureHorizTickHover);
         let pSM = pSE.merge(pS);

          /* update attr d in a transition if one was given.  */
          let p1 = (t === undefined) ? pSM
            : pSM.transition(t);
          p1.attr("d", function(tickY) {
           // based on axisFeatureTick(ai, d)
           /** shiftRight moves right end of tick out of axis zone, so it can
            * receive hover events.
            */
           const xOffset = 25, shiftRight=5;
           let ak = axisName,
               sLine = lineHoriz(ak, tickY, xOffset, shiftRight);
           return sLine;
         });
        }
       }
      );
    }

    /** Setup hover info text over scaffold horizTick-s.
     * Based on similar @see configureAxisTitleMenu()
     * @desc These are being factored to utils/hover.js :
     * @see configureHover, configureHorizTickHover
     */
    function  configureHorizTickHover(location)
    {
      console.log("configureHorizTickHover", location, this, this.outerHTML);
      /** typeof location may also be "number" or "object" - array : syntenyBlocks[x] */
      let text = (location == "string") ? location :  "" + location;
      let node_ = this;
      if ($(node_).popover)
      $(node_)
        .popover({
          trigger : "click hover",
          sticky: true,
          delay: {show: 200, hide: 3000},
          container: 'div#holder',
          placement : "auto right",
          /* The popover placement is 65px too high (might depend on window size).
           * As a simple fix, offset was tried with no apparent effect, possibly
           * depends on a recent version.  An alternative would be to use a
           * placement function.
           * offset : "0 65px",
           */
          /* Could show location in content or title; better in content because
           * when content is undefined a small content area is still displayed,
           * whereas undefined title takes no visual space.
           * title : location,
           */
           content : text
        });
    }

//-components/sb

    /*------------------------------------------------------------------------*/
    /** Draw  synteny blocks between adjacent axes.
     *
     * Uses isAdjacent(), which uses adjAxes[], calculated in
     * collateAdjacentAxes(), called via flows.alias : collateStacksA()
     *
     * @param t transition or undefined
     */
    function showSynteny(syntenyBlocks, t)
    {
      /** indexes into the columns of syntenyBlocks[]
       * 0,1 : chr0, chr1
       * 2,3,4,5 : gene 1,2,3,4
       */
      const SB_ID = 6, SB_SIZE = 7;
      let allowPathsOutsideZoom = me.get('allowPathsOutsideZoom');

      let sbS=oa.svgContainer.selectAll("g.synteny")
        .data(["synteny"]), // datum could be used for class, etc
      sbE = sbS.enter()
        .append("g")
        .attr("class", "synteny"),
      sbM = sbE.merge(sbS);
      if (trace_synteny)
        console.log("showSynteny", sbS.size(), sbE.size(), sbM.size(), sbM.node());

      function sbChrAreAdjacent(sb) {
        let a0 = sb[0], a1 = sb[1], adj = isAdjacent(a0, a1) || isAdjacent(a1, a0);
        return adj;
      }
      const sbSizeThreshold = me.get('sbSizeThreshold');
      function sbSizeFilter(sb) {
        return sb[SB_SIZE] > sbSizeThreshold;
      }
      function sbZoomFilter(sb) {
        let 
          inRangeLR = [[0, 2], [1, 4]]
          .map(([chrI, featureI]) => featureInRange(sb[chrI], sb[featureI])),
        inCount = inRangeLR.reduce((sum, flag) => sum += flag ? 1 : 0),
        lineIn = inCount >= (allowPathsOutsideZoom ? 1 : 2);
        return lineIn;
      }
      let adjSynteny = syntenyBlocks.filter(sbChrAreAdjacent)
        .filter(sbSizeFilter);
      if (oa.drawOptions.showAll) {
        adjSynteny = adjSynteny
          .filter(sbZoomFilter);
      }

      function blockLine (s) {
        let sLine = patham2(s[0], s[1], s.slice(2));
        if (trace_synteny > 3)
        console.log("blockLine", s, sLine);
        return sLine;
      }

      /** @return array [start, end]  */
      const f2Value = syntenyBlock_2Feature ?
            (blockId, f) => f.get('value') :
            (blockId, f0Name, f1Name) => [f0Name, f1Name].map((fName) => oa.z[blockId][fName].location);
      function intervalIsInverted(interval)
      {
        // could use featureY_(a, d0), if flipping is implemented via scale
        let inverted = interval[0] > interval[1];
        if (trace_synteny > 3)
          console.log("intervalIsInverted", interval, inverted);
        return inverted;
      }
      function syntenyIsInverted(s) {
        let
        /** if syntenyBlock_2Feature, [s[2], s[3]] is [start feature, undefined]
         * otherwise it is [start feature name, end feature name];
         * and similarly for s[4], s[5].
         */
        inverted = intervalIsInverted(f2Value(s[0], s[2], s[3]))
          != intervalIsInverted(f2Value(s[1], s[4], s[5]));
        if (trace_synteny > 3)
          console.log("syntenyIsInverted", s, inverted);
        return inverted;
      }

      function  syntenyBlockHoverText(sb)
      {
        let j=0, text = axisId2Name(sb[j++]) + "\n" + axisId2Name(sb[j++]);
        if (syntenyBlock_2Feature) {
          for (let fi = 0; fi++ < 2; ) {
            /** skip undefined following feature. */
            let f = sb[j];  j += 2;
            //  f.name is added as sb[SB_ID] (6)
            text += '\n' + f.value;
          }
        }
        for ( ; j < sb.length; j++) text += "\n" + sb[j];
        console.log("syntenyBlockHoverText", sb, text);
        return text;
      };
      function configureSyntenyBlockHover(sb)
      {
        configureHover.apply(this, [sb, syntenyBlockHoverText]);
      }

      function sbKeyFn(sb) {
        return sb[SB_ID];
      }

        let pS = sbM.selectAll("path.syntenyEdge")
          .data(adjSynteny, sbKeyFn),
        pSE = pS.enter()
          .append("path")
          .attr("class", "syntenyEdge")
          .classed("inverted", syntenyIsInverted)
          .each(configureSyntenyBlockHover)
          .call(configureSyntenyBlockClicks),
      pSX = pS.exit(),
        pSM = pSE.merge(pS)
          .attr("d", blockLine);
      pSX.remove();
      if (trace_synteny > 1)
        console.log("showSynteny", oa.syntenyBlocks.length, sbSizeThreshold, adjSynteny.length, pS.size(), pSE.size(), pSX.size(), pSM.size(), pSM.node());
      if (trace_synteny > 2)
        console.log(pSM._groups[0]);

    } // showSynteny()
    this.oa.axisApi.showSynteny ||= showSynteny;

    /*------------------------------------------------------------------------*/

    //- moved to collate-paths.js :
    /* aliasesUniqueName(), ensureFeatureIndex(), featureLookupName(),
     * collateData(), collateFeatureClasses(), maInMaAG(), collateStacks1(),
     * pathsUnique_log(), log_maamm(), log_ffaa(), mmaa2text(),
     */

    //- moved to stacks-adj.js : collateAdjacentAxes(), log_adjAxes(),  log_adjAxes_a(), isAdjacent()

    //- moved to stacks.js : axisId2Name()

    //- moved to collate-paths.js :
    /* getAliased(), collateStacksA(), objPut(),
     * aliasesText(), aliasText(),
     * addPathsToCollation(), addPathsByReferenceToCollation(),
     * storePath(), filterPaths(), selectCurrentAdjPaths(),
     * collateFeatureMap(), concatAndUnique(), featureStackAxes(),
     */


    /** This is equivalent to o[ak].
     * Whereas o[] keys are only axisIDs, this function handles block IDs.
     *
     * Where the feature d is in a child data block, featureY_(ak, d) requires
     * the block id not the id of the axis which contains the block.  So
     * functions which use featureY_() also use blockO().
     *
     * o[] contains x Offsets; the o may also have abbreviated Original, because
     * it caches axis positions.  Blocko can be renamed when axes are split out;
     * it is reminiscent of a bloco - a Carnival block party
     * (https://en.wikipedia.org/wiki/Carnival_block)
     */
    function blockO(ak)
    {
      let axis = Stacked.getAxis(ak);
      return o[axis.axisName];
    }

    /** A line between a feature's location in adjacent Axes.
     * @param ak1, ak2 block IDs
     * @param d feature name
     * Replaced by the stacks equivalent : @see featureLineS2()
     */
    function featureLine2(ak1, ak2, d)
    {
      let
        o = oa.o,
      /** use blockO() in place of o[] lookup to handle ak1,2 being child blocks */
      ends = [ak1, ak2].map(function (ak) {
        return [blockO(ak), featureY_(ak, d)]; });
      return line(ends);
    }
    /**  Return the x positions of the given axes; if the leftmost is split, add
     *  its width to the corresponding returned axis position.
     * The purpose is to give the x positions which paths between the 2 axes
     * should terminate at, hence the name 'inside' - it is concerned with the
     * inside edges of the axes from the perspective of the space between them.
     * @param ak1, ak2  axis IDs  (i.e. oa.axes[ak1] is Stacked, not Block)
     * @param cached  true means use the "old" / cached positions o[ak], otherwise use the current scale x(ak).
     * @return 2 x-positions, in an array, in the given order (ak1, ak2).
     */
    function inside(ak1, ak2, cached)
    {
      let xi = cached
        ? [o[ak1], o[ak2]]
        : [x(ak1), x(ak2)],
      /** true if ak1 is left of ak2 */
      order = xi[0] < xi[1],
      /** If the rightmost axis is split it does not affect the endpoint, since its left side is the axis position.
       * This is the index of the left axis. */
      left = order ? 0 : 1,
      akL = order ? ak1 : ak2,
      aL = oa.axes[akL];
      if (aL.extended)
      {
        // console.log("inside", ak1, ak2, cached, xi, order, left, akL);
        xi[left] += aL.extendedWidth();
      }
      return xi;
    }
    /** @return a short line segment, length approx 1, around the given point.
     */
    function pointSegment(point)
    {
      let  floor = Math.floor, ceil = Math.ceil,
      s = [[floor(point[0]), floor(point[1])],
               [ceil(point[0]), ceil(point[1])]];
      if (s[0][0] == s[1][0])
        s[1][0] += 1;
      if (s[0][1] == s[1][1])
        s[1][1] += 1;
      return s;
    }
    /** Stacks version of featureLine2().
     * A line between a feature's location in Axes in adjacent Stacks.
     * @param ak1, ak2 axis names, (exist in axisIDs[])
     * @param d1, d2 feature names, i.e. ak1:d1, ak1:d1
     * If d1 != d2, they are connected by an alias.
     */
    function featureLineS2(ak1, ak2, d1, d2)
    {
      let o = oa.o,
      axis1 = Stacked.getAxis(ak1),
      axis2 = Stacked.getAxis(ak2),
      /** x endpoints of the line;  if either axis is split then the side closer the other axis is used.  */
      xi = inside(axis1.axisName, axis2.axisName, true);
      let l;
      if (axis1.perpendicular && axis2.perpendicular)
      { /* maybe a circos plot :-) */ }
      else if (axis1.perpendicular)
      {
        let point = [xi[0] + vc.yRange/2 - featureY_(ak1, d1), featureY_(ak2, d2)];
        l =  line(pointSegment(point));
      }
      else if (axis2.perpendicular)
      {
        let point = [xi[1] + vc.yRange/2 - featureY_(ak2, d2), featureY_(ak1, d1)];
        l =  line(pointSegment(point));
      }
      else
      // o[p], the map location,
      l =  line([
        [xi[0], featureY_(ak1, d1)],
        [xi[1], featureY_(ak2, d2)]]);
      return l;
    }
    /** Show a parallelogram between 2 axes, defined by
     * 4 feature locations in Axes in adjacent Stacks.
     * Like @see featureLineS2().
     * @param ak1, ak2 axis names, (exist in axisIDs[])
     * @param d[0 .. 3] feature names, i.e. ak1:d[0] and d[1], ak2:d[2] and d[3]
     * update : see comment in patham2()
     */
    function featureLineS3(ak1, ak2, d)
    {
      let o = oa.o,
      axis1 = Stacked.getAxis(ak1),
      axis2 = Stacked.getAxis(ak2),
      xi = inside(axis1.axisName, axis2.axisName, false),
      oak = xi, // o[ak1], o[ak2]],
      my = syntenyBlock_2Feature ?
          [featureY2(ak1, d[0]), featureY2(ak2, d[2])] :
          [[featureY_(ak1, d[0]), featureY_(ak1, d[1])],
            [featureY_(ak2, d[2]), featureY_(ak2, d[3])]];
      let sLine;

      /** if one of the axes is perpendicular, draw a line segment using the d
       * values of the perpendicular axes as the x values, and the other as the
       * y values. */
      if (axis1.perpendicular && axis2.perpendicular)
      {  }
      else if (axis1.perpendicular)
      {
        xi[0] += vc.yRange/2;
        let s = [[xi[0] - my[0][0], my[1][0]],
                 [xi[0] - my[0][1], my[1][1]]];
        sLine =  line(s);
      }
      else if (axis2.perpendicular)
      {
        xi[1] += vc.yRange/2;
        let s = [[xi[1] - my[1][0], my[0][0]],
                 [xi[1] - my[1][1], my[0][1]]];
        sLine =  line(s);
      }
      else
      {
        let
        /** can use my here, with perhaps swapped my[1][0] and my[1][1] (because of swapped d[2] and d[3]).   */
        p = syntenyBlock_2Feature ?
          [
            [oak[0], my[0][0]],
            [oak[0], my[0][1]],
            [oak[1], my[1][1]],
            [oak[1], my[1][0]]] :
          [[oak[0], featureY_(ak1, d[0])],
           [oak[0], featureY_(ak1, d[1])],
           // order swapped in ak2 so that 2nd point of ak1 is adjacent 2nd point of ak2
           [oak[1], featureY_(ak2, d[3])],
           [oak[1], featureY_(ak2, d[2])],
          ];
        sLine = line(p) + "Z";
      }
      if (trace_synteny > 4)
        console.log("featureLineS3", ak1, ak2, d, oak, /*p,*/ sLine);
      return sLine;
    }

    /** Similar to @see featureLine().
     * Draw a horizontal notch at the feature location on the axis.
     * Used when showAll and the feature is not in a axis of an adjacent Stack.
     * @param ak axisID
     * @param d feature name
     * @param xOffset add&subtract to x value, measured in pixels
     */
    function featureLineS(ak, d, xOffset)
    {
      let akY = featureY_(ak, d);
      let shiftRight = 9;
      let o = oa.o,
      oak = blockO(ak);
      return line([[oak-xOffset + shiftRight, akY],
                   [oak+xOffset + shiftRight, akY]]);
    }
    /** calculate SVG line path for an horizontal line.
     *
     * Currently this is used for paths within axis group elt,
     * which is within stack elt, which has an x translation,
     * so the path x position is relative to 0.
     *
     * @param ak axisID.
     * @param akY Y	position (relative to axis of ak?)
     * @param xOffset add&subtract to x value, measured in pixels
     * Tick length is 2 * xOffset, centred on the axis + shiftRight.
     * @return line path for an horizontal line.
     * Derived from featureLineS(), can be used to factor it and featureLine()
     */
    function lineHoriz(ak, akY, xOffset, shiftRight)
    {
      /** scaled to axis */
      let akYs = oa.y[ak](akY);
      /* If the path was within g.foreground, which doesn't have x translation
       * for the stack, would calculate x position :
       * o = oa.o;  x position of axis ak : o[ak]
       */
      return line([[-xOffset + shiftRight, akYs],
                   [+xOffset + shiftRight, akYs]]);
    }
    /** Similar to @see featureLine2().
     * Only used in path_pre_Stacks() which will is now discarded;
     * the apparent difference is the param xOffset, to which path_pre_Stacks()
     * passed 5.
     * @param ak blockId containing feature
     * @param d feature name
     * @param xOffset add&subtract to x value, measured in pixels
     */
    function featureLine(ak, d, xOffset)
    {
      let
      akY = featureY_(ak, d);
      let o = oa.o, oak = blockO(ak);
      return line([[oak-xOffset, akY],
                   [oak+xOffset, akY]]);
    }
    //- moved to collate-paths.js : collateMagm()

//- paths
    /** This is the stacks equivalent of path() / zoompath().
     * Returns an array of paths (links between Axes) for a given feature.
     */
    function path(featureName) {
      let r = [];
      // TODO : discard features of the paths which change
      // pathFeatures = {};

      /** 1 string per path segment */
      let
        ffNf = flowsService.featureAxes[featureName];
      if (ffNf !== undefined)
        /* console.log("path", featureName);
         else */
        if ((unique_1_1_mapping === 2) && (ffNf.length > 1))
      { /* console.log("path : multiple", featureName, ffNf.length, ffNf); */ }
      else
        for (let i=0; i < ffNf.length; i++)
      {
          let [featureName, a0_, a1_, za0, za1] = ffNf[i];
          let a0 = a0_.axisName, a1 = a1_.axisName;
          if ((za0 !== za1) && (a0 == a1))
            console.log("path", i, featureName, za0, za1, a0, a1);
          if (a0_.axis && a1_.axis)
          {
            let paths = patham(a0, a1, featureName, undefined);
            r.push(paths);
          }
        }
      if (trace_path > 3)
        console.log("path", featureName, ffNf, r);
      if (r.length == 0)
        r.push("");
      return r;
    }

    /** for unique paths between features, which may be connected by alias,
     * data is [feature0, feature1, a0, a1]
     * Enabled by unique_1_1_mapping.
     * @param ffaa  [feature0, feature1, a0, a1]
     */
    function pathU(ffaa) {
      if ((ffaa === undefined) || (ffaa.length === undefined))
      { console.log("pathU", this, ffaa); breakPoint(); }
      let [feature0, feature1, a0, a1] = ffaa;
      let p = [];
      p[0] = patham(a0.axisName, a1.axisName, feature0, feature1);
      if (trace_path > 2)
        console.log("pathU", ffaa, a0.mapName, a1.mapName, p[0]);
      return p;
    }
    function pathUg(d) {
      let ffaa = dataOfPath(this),
      p = pathU(ffaa);
      if (trace_path > 2)
        console.log(this, d);
      return p;
    }

    /** TODO : for paths with alias group as data
     * @param aliasGroup   alias group (name)?
     */
    function pathAliasGroup(aliasGroup) {
      /** 1 string per path segment */
      let p = [],
      agafa = aliasGroupAxisFeatures[aliasGroup]; // to be passed from collateStacks().
      if (agafa === undefined)
        console.log("pathAliasGroup", aliasGroup);
      else
        for (let i=0; i < agafa.length; i++)
      {
          let [featureName, a0, a1, za0, za1] = agafa[i];
          p[i] = patham(a0.axisName, a1.axisName, featureName, undefined);
        }
      return p.join();
    }

    /** Calculate relative location of feature featureName in the axis axisID, and
     * check if it is inRange 
     * @param axisID  ID of Axis Piece
     * @param featureName  feature within axisID
     * @param range e.g. [0, yRange]
     */
    function inRangeI(axisID, featureName, range)
    {
      return inRange(featureY_(axisID, featureName), range);
    }
    /** as for inRangeI(), but param is a Feature, which is an interval (i.e. .values.length === 2) 
     * @return true if the interval of the feature overlaps range.
     */
    function inRangeI2(axisID, feature, range)
    {
      let ir = featureY2(axisID, feature)
          .some((vi) => inRange(vi, range));
      return ir;
    }

//- paths-text
    /** @param f  feature reference i.e. z[axisName][featureName]]
     * @return text for display in path hover tooltip */
    function featureAliasesText(fName, f)
    {
      let
        fas = f.aliases,
      s = fName + ":" + (fas ? f.aliases.length : "") + ":";
      if (fas)
      for (let i=0; i<fas.length; i++)
      {
        s += fas[i] + ",";
      }
      // console.log("featureAliasesText", fName, f, fas, s);
      return s;
    }

    /** Prepare a tool-tip for the line.
     * The line / path may be either connecting 2 axes, or a tick on one axis;
     * in the latter case fa1 will be undefined.
     * @param sLine svg path text
     * @param d0, d1 feature names, i.e. a0:f0 , a1:f1 .
     * Iff d1!==undefined, they are connected by an alias.
     * @param fa0, fa1  feature objects.
     * fa1 will be undefined when called from axisFeatureTick()
     * @param aliasDescription  undefined or text identifying the basis of the alias connection
     */
    function pathFeatureStore(sLine, d0, d1, fa0, fa1, aliasDescription)
    {
      let pathFeatures = oa.pathFeatures;
      if (pathFeatures[sLine] === undefined)
        pathFeatures[sLine] = {};

      /** Show the x,y coords of the endpoints of the path segment.  Useful during devel. */
      const showHoverLineCoords = false;
      const showHoverAliases = true;
      /** 1 signifies the normal behaviour - handleMouseOver() will show just the feature name.
       * Values other than 1 will be appended as text. */
      let hoverExtraText = showHoverExtraText ?
        " " + fa0.location +
        (fa1 ?  "-" + fa1.location : "")
        + (showHoverLineCoords ? " " + sLine : "")
      : 1;
      if (showHoverExtraText && showHoverAliases && aliasDescription)
        hoverExtraText += "<div><pre>" + aliasDescription + "</pre></div>";
      if (false)
      {
        hoverExtraText += 
          "<div>" + featureAliasesText(d0, fa0) + "</div>" +
          (d1 && fa1 ? 
           "<div>" + featureAliasesText(d1, fa1) + "</div>" : "");
      }
      // these are split (at ",") when assigned to hoverFeatures
      let d = d1 && (d1 != d0) ? d0 + "," + d1: d0;
      pathFeatures[sLine][d] = hoverExtraText; // 1;
    }

    /** Determine if the feature interval overlaps the zoomedDomain of its axis,
     * identified by axisName.
     * Equivalent to featureInRange() - see comments there also.
     *
     * @param  a0  axis name
     * @param d0 feature name, i.e. a0:d0
     */
    function featureNameInRange(a0, d0) {
      /** To allow lines which spread onto other axes in the same stack, but
       * still remain within the stack limits, unlike allowPathsOutsideZoom, use
       * [0, vc.yRange];
       */
      let
      a0_ = Stacked.getAxis(a0);
      /** If the block containing one end of the path is un-viewed, block.axis
       * may be undefined if render occurs before block-adj is destroyed . */
      if (!a0_) return undefined;
      let  range0 = a0_.yRange2();
      let ir = inRangeI(a0, d0, range0);
      return ir;
    }
    /** Equivalent to featureNameInRange(); param is feature instead of feature name.
     * @param  axisName ID of reference block of axis
     * @param feature ember data store object
     */
    function featureInRange(axisName, feature) {
      let a0 = axisName, d0 = feature;
      /** To allow lines which spread onto other axes in the same stack, but
       * still remain within the stack limits, unlike allowPathsOutsideZoom, use
       * [0, vc.yRange];
       */
      let
      ir,
      valueInInterval = me.get('controls').get('view.valueInInterval'),
      /** If the block containing one end of the path is un-viewed, block.axis
       * may be undefined if render occurs before block-adj is destroyed . */
      a0_ = Stacked.getAxis(a0);
      if (a0_) {
        let
        domain = a0_.axis1d?.zoomedDomain;
        ir = ! domain || valueInInterval(feature.value, domain);
      }
      return ir;
    }
    /**
     * @param  a0, a1  axis names
     * @param d0, d1 feature names, i.e. a0:d0, a1:d1.
     * Iff d1!==undefined, they are connected by an alias.
     */
    function patham(a0, a1, d0, d1) {
      // let [stackIndex, a0, a1] = featureAliasGroupAxes[d];
      let r;

      /** if d1 is undefined, then its value is d0 : direct connection, not alias. */
      let d1_ = d1 || d0;
      // can skip the inRangeLR[] calc if allowPathsOutsideZoom.
      /** Filter out those paths that either side locates out of the svg. */
      let
          inRangeLR = 
            [featureNameInRange(a0, d0),
             featureNameInRange(a1, d1_)],

        lineIn = me.get('allowPathsOutsideZoom') ||
            (inRangeLR[0]
             && inRangeLR[1]);
      // console.log("path()", stackIndex, a0, allowPathsOutsideZoom, inRangeI(a0), inRangeI(a1), lineIn);
      if (lineIn)
      {
        let sLine = featureLineS2(a0, a1, d0, d1_);
        let cmName = oa.cmName;
        let z = oa.z;
        let feature0 = d0, feature1 = d1,
        /** used for targeted debug trace (to filter, reduce volume)
         * e.g. = feature0 == "featureK" && feature1 == "featureK" &&
         cmName[a0].mapName == "MyMap5" && cmName[a1].mapName == "MyMap6"; */
        traceTarget = 
          ((trace_path_count !== undefined) && (trace_path_count-- > 0))
           || (trace_path > 4);
        if (traceTarget)
          console.log("patham()", d0, d1, cmName[a0] && cmName[a0].mapName, cmName[a1] && cmName[a1].mapName, a0, a1, z && z[a0] && z[a0][d0] && z[a0][d0].location, d1 && z && z[a1] && z[a1][d1] && z[a1][d1].location, sLine);
        r = sLine;
        if (pathDataIsLine)
          /* Prepare a tool-tip for the line. */
          pathFeatureStore(sLine, d0, d1, z[a0][d0], z[a1][d1_]);
      }
      else if (me.get('controls.view.tickOrPath') === 'tick') {
        // tickOrPath replaces oa.drawOptions.showAll
        const featureTickLen = 10; // orig 5
        function axisFeatureTick(ai, d) {
          let z = oa.z;
          if (d in z[ai])
          {
            r = featureLineS(ai, d, featureTickLen);
            pathFeatureStore(r, d, d, z[ai][d], undefined);
          }
        }
        // Filter these according to inRangeI() as above : return 0 or 1 ticks, not 2 because at least one is out of range.
          if (inRangeLR[0])
              axisFeatureTick(a0, d0);
          if (inRangeLR[1])
              axisFeatureTick(a1, d1_);
      }
      return r;
    }
    /** patham() draws a line (1-d object),  patham2 draws a parallelogram (2-d object).
     * @param  a0, a1  axis names
     * @param d[0 .. 3], feature names, i.e. a0:d[0]-d[1], a1:d[2]-d[3].
     * Unlike patham(), d does not contain undefined.
     * added : for syntenyBlock_2Feature, d is [d0, undefined, d2, undefined]
     * i.e. features d0 and d2 are intervals not points.
     */
    function patham2(a0, a1, d) {
      let r;
      let range = [0, vc.yRange];

      /** Filter out those parallelograms which are wholly outside the svg, because of zooming on either end axis. */
      let
      lineIn = me.get('allowPathsOutsideZoom') ||
        (syntenyBlock_2Feature ?
         inRangeI2(a0, d[0], range) ||
         inRangeI2(a1, d[2], range) : 
        (inRangeI(a0, d[0], range)
         || inRangeI(a0, d[1], range)
         || inRangeI(a1, d[2], range)
         || inRangeI(a1, d[3], range)));
      if (lineIn)
      {
        let sLine = featureLineS3(a0, a1, d);
        let cmName = oa.cmName;
        if (trace_synteny > 4)
          console.log(
            "patham2()", d, cmName[a0] && cmName[a0].mapName, cmName[a1] && cmName[a1].mapName, a0, a1,
            z && z[a0] && z[a0][d[0]] /*&& z[a0][d[0]].location*/,
            d[2] && z && z[a1] && z[a1][d[2]] /*&& z[a1][d[2]].location*/, sLine);
        r = sLine;
      }
      /* for showAll, perhaps change the lineIn condition : if one end is wholly
       * in and the other wholly out then show an open square bracket on the
       * axis which is in. */

      return r;
    }

    /** Calculate relative feature location in the axis.
     * Result Y is relative to the stack, not the axis,
     * because .foreground does not have the axis transform (Axes which are ends
     * of path will have different Y translations).
     *
     * @param axisID name of axis or block  (if it is an axis it will be in axisIDs[])
     * This parameter is the difference with the original featureY() which this function replaces.
     * @param d feature name
     */
    function featureY_(axisID, d)
    {
      // z[p][f].location, actual position of feature f in the axis p, 
      // y[p](z[p][f].location) is the relative feature position in the svg
      // ys is used - the y scale for the stacked position&portion of the axis.
      let parentName = Block.axisName_parent(axisID),
      ysa = oa.ys[parentName],
      /** if d is object ID instead of name then featureIndex[] is used */
      feature = oa.z[axisID][d] || lookupFeature(oa, flowsService, oa.z, axisID, d), // || oa.featureIndex[d],
      aky = ysa(feature.location),
      /**  As noted in header comment, path Y value requires adding axisY = ... yOffset().
       * parentName not essential here because Block yOffset() follows .parent reference. */
      axisY = oa.stacks.blocks[axisID].yOffset();
      // can use parentName here, but initially good to have parent and child traced.
      if (trace_scale_y && ! tracedAxisScale[axisID])
      {
        tracedAxisScale[axisID] = true;
        let yDomain = ysa.domain();
        console.log("featureY_", axisID,  axisName2MapChr(axisID), parentName, d,
                      z[axisID][d].location, aky, axisY, yDomain, ysa.range());
      }
      return aky + axisY;
    }
    /** as for featureY_(), but param is a Feature, with value.length === 2.
     * @param feature
     * @return [start,end]  feature interval Y relative to the stack.
     */
    function featureY2(axisID, feature)
    {
      let
      // axisID = feature.get('blockId'),
      /** or .view.axisName */
      parentName = Block.axisName_parent(axisID),
      ysa = oa.ys[parentName],
      v = feature.value,
      aky = v.map((location) => ysa(location)),
      axisY = oa.stacks.blocks[axisID].yOffset();

      return aky.map((y) => y + axisY);
    }


//- axis-brush-zoom

    /** Map brushedRegions into an array parallel to selectedAxes[]. */
    function getBrushExtents() {
      /** Extent of current brush (applied to y axis of a axis). */
      let
        brushExtents = selectedAxes.map(function(p) { return brushedRegions[p]; }); // extents of active brushes
      return brushExtents;
    }
    /** Could use this instead of maintaining oa.brushedRegions :
     */
    function getBrushedRegions() {
      let brushedRegions = d3.selectAll('g.brush > g[clip-path]').nodes().reduce((br, e) => { let s = e.__brush.selection; br[e.__data__] = [s[0][1], s[1][1]]; return br; }, {});
      return brushedRegions;
    }
   
    /** Return the brushed domain of axis p
     * Factored from brushHelper(); can use axisBrushedDomain() to replace that code in brushHelper().
     */
    function axisBrushedDomain(p, i)
    {
      let brushExtents = getBrushExtents();

      if (! brushExtents[i]) {
        dLog('axisBrushedDomain no brush for', p, i, brushExtents);
        return undefined;
      }
      let brushedDomain = axisRange2Domain(p, brushExtents[i]);
      console.log('axisBrushedDomain', p, i, brushExtents, brushedDomain);
      return brushedDomain;
    }
    /** Convert the given brush extent (range) to a brushDomain.
     * @param p axisID
     * @return function to convert range a value to a domain value.
     * undefined if scale has no domain.
     */
    function axisRange2DomainFn(p)
    {
      let
        yp = oa.y[p];
      let ypDomain = yp.domain();
      if (! ypDomain || ! ypDomain.length)
        return undefined;
      function fn(ypx) { return yp.invert(ypx /* *axis.portion */); };
      return fn;
    }
    /** Convert the given brush extent (range) to a brushDomain.
     * @param p axisID
     * @param range a value or an interval in the axis range.  This may be e.g. a brush extent
     * @return domain the (reverse) mapping of range into the axis domain.
     * undefined if range is undefined.
     */
    function axisRange2Domain(p, range)
    {
      // axisRange2Domain{,Fn} are factored from axisBrushedDomain(), and brushHelper()
      let
        r2dFn = axisRange2DomainFn(p);
      if (! r2dFn) {
        dLog('axisRange2Domain', p, range, 'scale has no domain', oa.y[p].domain());
        return undefined;
      }
      if (! range) {
        return undefined;
      }
      let
      axis = oa.axes[p],
      brushedDomain = range.length ? range.map(r2dFn) : r2dFn(range);
      if (range.length && axis.flipped)
      {
        let swap = brushedDomain[0];
        brushedDomain[0] = brushedDomain[1];
        brushedDomain[1] = swap;
      }
      if (trace_scale_y)
        dLog('axisRange2Domain', p, range, brushedDomain);
      return brushedDomain;
    }

    /** update brush selection position for window / element height resize.
     * @param gBrush  <g clip-path> within <g.brush>
     */
    function axisBrushShowSelection(p, gBrush) {
      let yp = oa.y[p],
      brushedAxisID = p;
      /* based on similar functionality in zoom() which updates brush
       * extent/position for (zoom) scale change (brushedDomain does not change).
       *
       * If axisBrush.brushedDomain is not available, can use brushedDomains
       * calculated from existing brush extent in showResize before the scale is changed.
       */
      let brushedDomain;
      if (! brushedDomain) {
        let axisBrush = me.get('store').peekRecord('axis-brush', brushedAxisID);
        brushedDomain = axisBrush && axisBrush.get('brushedDomain');
      }
      if (brushedDomain) {
        let newBrushSelection = brushedDomain.map(function (r) { return yp(r);});
        console.log('axisBrushShowSelection', brushedAxisID, brushedDomain, gBrush, newBrushSelection);
        if ((newBrushSelection[0] < -1e3) || (newBrushSelection[1] > 1e4)) {
          // when zoomedDomain is set by setDomainFromDawn(), the current brush is likely to be way out of scope.
          dLog('brush selection is large after scale change - removing', p);
          removeBrushExtent(p);
          newBrushSelection = null; // clear the brush selection
        }
        if (newBrushSelection) {
          /* brush extent is required to be +ve interval. */
          newBrushSelection = maybeFlip(newBrushSelection, newBrushSelection[0] > newBrushSelection[1]);
        }
        d3.select(gBrush).call(yp.brush.move, newBrushSelection);
      }
    }

    /** Used when the user completes a brush action on the axis axis.
     * The datum of g.brush is the ID/name of its axis, call this axisID.
     * If null selection then remove axisID from selectedAxes[], otherwise add it.
     * Update selectedFeatures{}, brushedRegions{} : if selectedAxes[] is empty, clear them.
     * Otherwise, set brushedRegions[axisID] to the current selection (i.e. of the brush).
     * Set brushExtents[] to the brushedRegions[] of the Axes in selectedAxes[].
     * For each axis in selectedAxes[], clear selectedFeatures{} then store in it the
     * names + locations of features which are within the brush extent of the axis.
     * Add circle.axisID for those feature locations.
     * Remove circles of features (on all Axes) outside brushExtents[axisID].
     * For elements in '.foreground > g.flowName > g', set class .faded iff the feature (which
     * is the datum of the element) is not in the selectedFeatures[] of any axis.
     *
     * Draw buttons to zoom to the brushExtents (zoomSwitch) or discard the brush : resetSwitch.
     * Called from brushended(), which is called on(end) of axis brush.
     *
     * @param that  the brush g element.
     * The datum of `that` is the name/ID of the axis which owns the brushed axis.
     * 
     */
    function brushHelper(that) {
      // Chromosome name, e.g. 32-1B
      /** name[0] is axisID of the brushed axis. name.length should be 1. */
      let name = d3.select(that).data();
      let brushedAxisID = name[0];

      let svgContainer = oa.svgContainer;
      //Remove old circles.
      axisFeatureCircles_selectAll().remove();
      let brushedRegions = oa.brushedRegions;
      let
      brushRange = d3.event.selection,
      /** d3.mouse() calls : function point(node, event) { .. point.x = event.clientX, point.y = event.clientY;
       * so don't call mouse if those are undefined.
       */
      eventHasClientXY = (d3.event.clientX !== undefined) && (d3.event.clientX !== undefined),
      mouse = brushRange && eventHasClientXY && d3.mouse(that);
      let brushSelection = d3.brushSelection(d3.select(that));
      let brush_ = that.__brush,
      brushSelection_ = brush_.selection,
      brushExtent_ = brush_.extent;
      /** selects the g which may have .faded added.  Exclude g.progress because
       * featureNotSelected2() does not yet support its datum type, and we
       * should check with users if this feature should be maintained or varied.
       */
      const fadedSelector = ".foreground > g:not(.progress) > g";

      if (trace_gui)
        console.log("brushHelper", that, brushedAxisID, selectedAxes, brushRange, brushedRegions,
                    brushSelection, mouse,
                    brushSelection_ ? '' + brushSelection_[0] + '' + brushSelection_[1] : '', ', ',
                    brushExtent_ ? '' + brushExtent_[0] + ',' + brushExtent_[1] : ''
                   );

      /* d3.event.selection is null when brushHelper() is called via zoom() ... brush.move.
       * This causes selectedAxes to update here; when an axis is zoomed its brush is removed.
       */
      if (brushRange == null) {
        removeBrushExtent(brushedAxisID);
      }
      else {
        selectedAxes.addObject(name[0]); 
        brushedRegions[brushedAxisID] = brushRange;
      }

      // selectedAxes is an array containing the IDs of the Axes that
      // have been selected.
      
      if (selectedAxes.length > 0) {
        axisFeatureCirclesBrushed();
        
        if (! oa.axisApi.axisFeatureCirclesBrushed) {
          oa.axisApi.axisFeatureCirclesBrushed = axisFeatureCirclesBrushed;
        }

        /** For those axes in selectedAxes, if the axis has a brushed region,
         * draw axis circles for features within the brushed region.
         */
        function axisFeatureCirclesBrushed() {
          /* This function can be split out similarly to axis-1d.js :
           * FeatureTicks; possibly a sub-component of axis-1d.
           */

          let valueInInterval = me.get('controls').get('view.valueInInterval');

          let selectedAxes = oa.selectedAxes;
        console.log("Selected: ", " ", selectedAxes.length);
        // Axes have been selected - now work out selected features.

        let brushExtents = getBrushExtents();

        selectedFeatures = {};
        /** selectedFeaturesSet contains feature f if selectedFeatures[d_b][f] for any dataset/block d_b.
         * This is used to efficiently implement featureNotSelected2() which implements .faded.
         */
        let selectedFeaturesSet = new Set();
        /**
         * @param p an axis selected by a current user brush
         * @param i index of the brush of p in brushExtents[]
         */
        selectedAxes.forEach(function(p, i) {
          /** d3 selection of one of the Axes selected by user brush on axis. */
          let axisS = oa.svgContainer.selectAll("#" + eltId(p));

          // blockS = oa.stacks.axes[p],

          let notBrushed = brushExtents[i] === undefined,
          enable_log = notBrushed;
            if (enable_log)
            console.log("brushHelper", p, i);
          /* brushExtents[i] is required for the following calculation of
           * brushedDomain and hence the filtering, so return if it is undefined.
           * The above selectedAxes.removeObject() is intended to prevent this but it seems to miss some case.
           * And selectedAxes[] does not only derive from brushes - an axis can be selected in the data explorer.
           * The whole flow of calculation in brushHelper() needs to be changed :
           * it is unnecessary to traverse selectedAxes[] - only 1 axis has
           * been brushed, and p is known via (thisElement.__data__, name[0], brushedAxisID).
           * brushExtents[] is not required, and brushedRegions[] can be
           * independent of selectedAxes[].
           */
          if (notBrushed)
            return;

          // this can use axisRange2Domain() which is based on this function.
          // if yp.domain() is [], then this won't be useful.
          let yp = oa.y[p],
          axis = oa.axes[p],
          brushedDomain = brushExtents[i].map(function(ypx) { return yp.invert(ypx /* *axis.portion */); });
          if (axis.flipped)
          {
            let swap = brushedDomain[0];
            brushedDomain[0] = brushedDomain[1];
            brushedDomain[1] = swap;
          }

          if (enable_log)
            console.log("brushHelper", name, p, yp.domain(), yp.range(), brushExtents[i], axis.portion, brushedDomain);

          /** for all data blocks in the axis; reference blocks don't contain
           * features so don't brush them. */
          /* can pass visible=true here - a slight optimisation; it depends on the
           * expression in dataBlocks() which distinguishes data blocks. */
          let childBlocks = axis.dataBlocks(true, false)
              /** Until d398e98e, this was filtered by .isBrushableFeatures; changed because
               * if there are paths (& hence features) loaded, then it makes sense to brush those.
               * (isBrushableFeatures() is concerned with whether more features should be requested, which is different).
               */
              ; // .filter((blockS) => blockS.block.get('isBrushableFeatures'));
          let range = [0, axis.yRange()];
          console.log(axis, 'childBlocks', childBlocks, range);
          /*
           * The circles have class feature.name (which should be prefixed with
           * a letter), which may not be unique between sibling blocks of an
           * axis.
           * Using combinedId below is sufficient to implement transitions,
           * but a more structured design is preferable to insert a layer : a <g> for
           * each block, with datum blockId or block, to wrap the <circle>s, and
           * a featuresOfBlock(blockId)->blockFeatures[] for the circle data.
           */
          childBlocks.map(function (block) {

          let
            blockR = block && block.block,
          /** compound name dataset:block (i.e. map:chr) for the selected axis p.  */
          mapChrName = blockR.get('brushName');
          selectedFeatures[mapChrName] = [];

          /** The initial application, Marker Map Viewer, was for genetic maps,
           * for which marker names are unique within a chromosome, and the data
           * structure reflected this : (z[axisName][featureName] -> location).
           * Now block.get('features') is used - providing the full array of
           * features, regardless of uniqueness of names.
           */
          let blockFeatures = block.block.get('features');  // was oa.z[block.axisName];
          /*d3.keys()*/ blockFeatures.forEach(function(feature) {
            let f = feature.name;
            // let feature = blockFeatures[f];
            let value = feature?.value;
            /** fLocation is value[0], i.e. the start position. The circles are placed
             * at fLocation, and the end position is not currently shown.
             * A feature is selected if its interval [start,end], i.e. .value,
             * overlaps the brush thumb [start,end].
             */
            let fLocation;
            if (/*! isOtherField[f] && */ ((fLocation = feature.location) !== undefined))
            {
              /** range is from yRange() which incorporates .portion, so use ys rather than axis.y. */
              let yScale = oa.ys[p];
              let yPx;
              /** the brushedDomain may be out of the current zoom scope, so intersect .value with range also.
               */
            if (block.visible &&
                valueInInterval(feature.value, brushedDomain) &&
                valueInInterval(value.map(yScale), range)
               ) {
              //selectedFeatures[p].push(f);
              selectedFeaturesSet.add(f);
              // previously pushed : f + " " + fLocation
              selectedFeatures[mapChrName].push(feature);
              /** Highlight the features in the brushed regions
               * o[p] : the axis location;  now use 0 because the translation of parent g.axis-outer does x offset of stack.
               * fLocation :  actual feature position in the axis, 
               * yp(fLocation) :  is the relative feature position in the svg
               */
              /** lacking the g.block structure which would enable f (feature.name) to be
               * unique within its parent g, this combinedId enables transition
               * to be implemented in an improvised way.
               * Update : originally (Genetic Maps) feature.name was unique within block,
               * now use feature.id because feature.name can be repeated within block.
               */
              let combinedId = axisFeatureCircles_eltId(feature),
              dot = axisS.selectAll('circle#' + combinedId);
              if (! dot.empty()) {
                dot
                  .transition().duration(200)
                  .attr("cy", yp(fLocation));
              }
              else {
              dot = axisS
                .append("circle")
                .attr('id', combinedId)
                .attr("class", eltClassName(f))
                .attr("cx",0)   /* was o[p], but g.axis-outer translation does x offset of stack.  */
                .attr("cy", yp(fLocation))
                .attr("r",2)
                .style("fill", "red");
                brushEnableFeatureHover(dot);
              /* This can be done via an added class and css :
               * r, fill, stroke are toggled (to 5,yellow,black) by
               * @see table-brushed.js: highlightFeature() */
              }
            } else {
               axisFeatureCircles_selectOneInAxis(axisS, feature)
                .remove();
            }
            }
          });
          });
        });
        sendUpdatedSelectedFeatures();

        function featureNotSelected2(d)
        {
          let sel =
            unique_1_1_mapping && (typeof d != 'string') ?
            ( selectedFeaturesSet.has(d[0]) ||
              selectedFeaturesSet.has(d[1]) )
            : selectedFeaturesSet.has(d);
          /* if (sel)
            console.log("featureNotSelected2", unique_1_1_mapping, d, selectedFeaturesSet); */
          return ! sel;
        }

        d3.selectAll(fadedSelector).classed("faded", featureNotSelected2);
      } // axisFeatureCirclesBrushed()

        showAxisZoomResetButtons(svgContainer, getBrushExtents, zoom, bind(me, me.get('resetZooms')), brushedAxisID, me);

      } else {
        // brushHelper() is called from brushended() after zoom, with selectedAxes.length===0
        // At this time it doesn't make sense to remove the resetSwitch button

        // No axis selected so reset fading of paths or circles.
        console.log("brushHelper", selectedAxes.length);
        // some of this may be no longer required
        if (false)
          svgContainer.selectAll(".btn").remove();
        axisFeatureCircles_selectAll().remove();
        d3.selectAll(fadedSelector).classed("faded", false);
        selectedFeatures_clear();
        /* clearing brushedRegions is not needed here because resetBrushes() (by
         * clearing the brushes) causes brushHelper() to remove brushes from
         * brushedRegions.
         * (and changing the value of brushedRegions in draw() closure would
         * require using oa.brushedRegions instead).
         * brushedRegions = oa.brushedRegions = {};
         */
      }
      let axisBrush = me.get('store').peekRecord('axis-brush', brushedAxisID);
      if (!axisBrush) {
        let axis = Stacked.getAxis(brushedAxisID);
        let block = me.peekBlock(brushedAxisID);
        axisBrush = me.get('pathsP').ensureAxisBrush(block);
        console.log('axis', axis, axis.block, block, 'axisBrush', axisBrush);
      }
      let yp = oa.y[brushedAxisID];
      ensureYscaleDomain(yp, oa.axes[brushedAxisID]);
      let brushedDomain = brushRange ? axisRange2Domain(brushedAxisID, brushRange) : undefined;
      axisBrush.set('brushedDomain', brushedDomain);

      let axis = oa.axes[brushedAxisID],
          axis1d = axis && axis.axis1d;
      if (axis1d) {
        bind(axis1d, axis1d.showZoomResetButtonState)();
      }

      me.attrs.selectChromById(brushedAxisID);

    } // brushHelper


          /** Call resetZoom(axisId) - reset the zoom of one or all zoomed axes (selectedAxes).
           * Applies to the specified axis, or all brushes if axisId is undefined.
           * @param  axisId  db id of reference block of axis (i.e. .axisName) or undefined
           * @desc resetZooms() resets both the brush/es and the
           * zoom/s, and is callable via feed.trigger(), whereas resetZoom()
           * clears just the zoom and is local.
           */
        // console.log("me.get('resetZooms')", me.get('resetZooms') !== undefined);
          if (! me.get('resetZooms'))
          me.set('resetZooms', function(axisId) {
            console.log('resetZooms', axisId, oa.selectedAxes, oa.brushedRegions);
            resetBrushes(axisId);
            resetZoom(axisId);
            console.log('after resetZoom', axisId, oa.selectedAxes, oa.brushedRegions);
          });
        /** Clear the brush of the specified axis, or all brushes if axisId is undefined.
         * @param  axisId  db id of reference block of axis (i.e. .axisName) or undefined
         */
        function resetBrushes(axisId)
        {
          let
          axisClipId = axisId ? '="url(#axis-clip-' + axisId + ')"' : '',
          brushSelector = "g.axis-all > g.brush > g[clip-path" + axisClipId + "]",
          brushExtents;
          if (axisId) {
            brushExtents = [brushedRegions[axisId]];
          } else {
            /** brushed[j] may correspond to oa.selectedAxes[j] and hence
             * brushExtents[j], but it seems possible for their order to not
             * match.  This is only used in trace anyway.
             */
            brushExtents = getBrushExtents();
          }
          let brushed = d3.selectAll(brushSelector);
          brushed.each(function (axisName, i, g) {
            /* `this` refers to the brush g element.
             * pass selection==null to clear the brush.
             * clearing the brush triggers brushHelper() which removes the brush from selectedAxes[] and brushedRegions.
             * and hence index is 0.
             */
            let j = i;
            dLog('resetBrushes', axisId, this, axisName, oa.selectedAxes[j], oa.brushedRegions[axisName], brushExtents[j]);
            if (this.__brush)
              d3.select(this).call(y[axisName].brush.move, null);
            let brushedAxisID = axisName;
            /* the above call(brush.move, null) causes
             * brushedRegions[brushedAxisID] to be deleted, via :
             * brushended() -> brushHelper() -> removeBrushExtent()
             . */
            if (oa.brushedRegions[brushedAxisID])
              removeBrushExtent(brushedAxisID);
          });
        }

    /** remove the brush extent of brushedAxisID from brushedRegions[] */
    function removeBrushExtent(brushedAxisID) {
        console.log('removeBrush', brushedAxisID);
        oa.selectedAxes.removeObject(brushedAxisID);
        delete oa.brushedRegions[brushedAxisID];
    }
          /** Reset 1 or all zooms.
           * @param axisID  axis id to reset; undefined means reset all zoomed axes.
           */
          function resetZoom(axisID)
          {
            let svgContainer = oa.svgContainer;
            let t = svgContainer.transition().duration(750);
            /** rather than all of axisIDs(), should be sufficient to use
             * selectedAxes (related to brushedRegions)
             */
            let axisIDs = axisID ? [axisID] : oa.stacks.axisIDs();
            axisIDs.forEach(function(d) {
              let idName = axisEltId(d); // axis ids have "a" prefix
                if (d != axisID)
                  console.log('resetZoom', d, axisID);
              let a = oa.axes[d],
              domain = a.parent ? a.parent.domain : a.getDomain();
              domain = maybeFlip(domain, a.flipped);
              a.setZoomed(false);
              oa.y[d].domain(domain);
              oa.ys[d].domain(domain);
              a.setDomain(domain);
              let yAxis = a.axisSide(oa.y[d]).ticks(10);
              oa.svgContainer.select("#"+idName).transition(t).call(yAxis);
            });
            let axisTickS = svgContainer.selectAll("g.axis > g.tick > text");
            axisTickS.attr("transform", yAxisTicksScale);
            // axisStackChanged(t);
            me.throttledZoomedAxis(axisID, t);

            pathUpdate(t);
            let resetScope = axisID ? axisS : svgContainer;
              resetScope.selectAll(".btn").remove();
            if (axisID === undefined)
            {
              // reset zoom of all axes clears selectedFeatures - check if this was the intention; also should selectedAxes be cleared ?
              selectedFeatures_clear();
            }
          }


    let targetIdCount = 0;
    function handleFeatureCircleMouseOver(d, i)
    {
      let
      /** d is the axis chromosome id */
        chrName = d,
      featureName = this.classList[0],
      hoverFeatures = featureName ? [featureName] : [];
      if (oa.drawOptions.showCircleHover)
      {
        /** related @see axisFeatureCircles_selectAll() */
        let
          selector = "g.axis-outer#" + eltId(chrName) + " > circle." + CSS.escape(featureName),
        targetId = "MC_" + ++targetIdCount;
        console.log("handleFeatureCircleMouseOver", d, featureName, selector, targetId);
        if (false)
        {
          d3.select(selector)
            .attr('id', targetId);  // will add selector support to ember-tooltip targetId
        }
        else
        {
          toolTip.html('<span id="AxisCircleHoverTarget">AxisCircleHoverTarget</span>');
          toolTip.show(d, i);
          targetId = "devel-visible";
        }
      }
      //  me.set("axisFeatureTargetId", targetId);
      once(function() {
        me.set("hoverFeatures", hoverFeatures);
        // me.set("axisFeatureCircleHover", true);
      });
    }
    function handleFeatureCircleMouseOut(d, i)
    {
      if (false)
      debounce(
        function() {
          me.set("axisFeatureCircleHover", false);
        },
        10000);
      else
      {
        function hidePathHoverToolTip() { toolTip.hide(d); }
        debounce(hidePathHoverToolTip, 1000);
      }
    }
    function brushEnableFeatureHover(circleSelection)
    {
      circleSelection
        .on("mouseover", handleFeatureCircleMouseOver)
        .on("mouseout", handleFeatureCircleMouseOut);
    }


    /** Zoom the y axis of this axis to the given brushExtents[].
     * Called via on(click) of brushHelper() Zoom button (zoomSwitch).
     * Traverse selected Axes, matching only the axisName of the brushed axis.
     * Set the y domain of the axis, from the inverse mapping of the brush extent limits.
     * Remove the zoom button, redraw the axis, ticks, zoomPath. Move the brush.
     * @param that  the brush g element.
     * The datum of `that` is the name of the axis which owns the brushed axis.
     * @param brushExtents  limits of the current brush, to which we are zooming
     */
    function zoom(that, brushExtents) {
      const fnName = 'zoom';
      const trace_zoom = 0;
      /** can be undefined in some cases. it is defined for WheelEvent - mousewheel zoom. */
      let e = d3.event.sourceEvent;
      let isWheelEvent = d3.event.sourceEvent instanceof WheelEvent;
      let timeStamp = e && e.timeStamp;
      me.set('axisZoom.zoomPan', {isWheelEvent, timeStamp});
      if (trace_zoom > 0 + isWheelEvent)
      console.log('zoom', that, brushExtents, arguments, this);
      let axisName;
      if (isWheelEvent) {
        axisName = arguments[0];
        brushExtents = undefined;
        let w = e;
        if (trace_zoom > 1) 
        console.log(
          'WheelEvent', d3.event.sourceEvent, d3.event.transform, d3.event,
          '\nclient', w.clientX, w.clientY,
          'deltaY', w.deltaY,
          'layer', w.layerX, w.layerY,
          'movement', w.movementX, w.movementY,
          'offset', w.offsetX, w.offsetY,
          'page', w.pageX, w.pageY,
          'screen', w.screenX, w.screenY,
          'wheelDeltaY', w.wheelDeltaY,
          '.', w.x, w.y
        );
        /* The only apparent reason to add axis to selectedAxes[] when
         * mouse-wheel zoom is to prop up selectedAxes_i below, which will be
         * replaced.
         *
         * A couple of side-effects of WheelEvent adding axis to selectedAxes[] :
         * . draw_flipRegion() will apply to it;
         * . it is not apparent to the user that they should clear it,
         * by clicking on axis, to remove class .faded.
         */
         selectedAxes.addObject(axisName);
      }
      else if (e instanceof MouseEvent) {
        console.log(
          'MouseEvent', e);
      }
      else
      {
      axisName = d3.select(that).data();
      if (axisName.length == 1)
        axisName = axisName[0];
      }
      /* if parent (reference) block arrives after child (data) block, the brush
       * datum is changed from child to parent in adoption.  This code verifies
       * that.
       */
      let axis = oa.axesP[axisName],
      parentName = Block.axisName_parent(axisName);
      if (! axis || (parentName != axisName))
        breakPoint('zoom changing datum', axisName, 'to', parentName);
      else
        axis.verify();

      let t = oa.svgContainer; // .transition().duration(750);
      /** The response to mousewheel zoom is direct, no transition delay.  requestAnimationFrame() is used. */
      let tRaf = undefined; // or t.duration(10);
      /** true if the axis domain is changed. */
      let domainChanged = false;

      /* this uses .map() to find i such that selectedAxes[i] == axisName,
       * and i is used to lookup the parallel array brushExtents[].
       * #afterRelease, selectedAxes / brushExtents / brushedRegions can be
       * better integrated, simplifying this calc and others.
       */
      let selectedAxes_i = 
        selectedAxes.reduce(function(result, p, i) {
          if(p == axisName){
            result.push([p, i]);
          }
          return result;
        }, []);
      selectedAxes_i.forEach(function(p_i) {
        let [p, i] = p_i;
        {
          let y = oa.y, svgContainer = oa.svgContainer;
          if (brushExtents)
          // possibly selectedAxes changed after this callback was registered
          // The need for brushExtents[] is not clear; it retains earlier values from brushedRegions, but is addressed relative to selectedAxes[].
          if (brushExtents[i] === undefined)
          {
            console.log("zoom() brushExtents[i]===undefined", axisName, p, i, "use", brushedRegions[p]);
            brushExtents[i] = brushedRegions[p];
          }
          let yp = y[p],
          ypDomain = yp.domain(),
          axis = oa.axes[p],
          domain,
          brushedDomain;
          ensureYscaleDomain(yp, axis);
          if (brushExtents && brushExtents[i]) {
          brushedDomain = brushExtents[i].map(function(ypx) { return yp.invert(ypx /* *axis.portion*/); });
          // brushedDomain = [yp.invert(brushExtents[i][0]), yp.invert(brushExtents[i][1])];
          console.log("zoom", axisName, p, i, yp.domain(), yp.range(), brushExtents[i], axis.portion, brushedDomain);
            domain = brushedDomain;
          }
          else if (d3.event.sourceEvent)  // if there is a mousewheel event
          {
            /** note the brushedDomain before the scale change, for updating the brush position */
            let brushExtent = oa.brushedRegions[p];
            if (brushExtent)
              brushedDomain = axisRange2Domain(p, brushExtent);

            domain = wheelNewDomain(axis, oa.axisApi, false);  // uses d3.event, d3.mouse()
          }
          if (! axis.axis1d) {
            let a1 = axis?.blocks?.mapBy('block.axis1d');
            dLog(fnName, axisName, axis, a1, a1?.mapBy('isDestroying'));
            // axis.log();
          } else
          if (domain) {
            domainChanged = true;
            /** mousewheel zoom out is limited by javascript
             * precision, so consider domain equal if first 7 chars
             * are equal.  */
            function limitPrecision(x) { return ('' + x).substr(0,7); };
            let 
            /** total domain */
            domainAll = axis.axis1d.get('blocksDomain').toArray(),
            domainAllS = domainAll.map(limitPrecision),
            domainFS = maybeFlip(domain, axis.flipped).map(limitPrecision),
            /** true if (mousewheel) zoomed out to the limit of the whole domain. */
            zoomedOut = isEqual(domainAllS, domainFS);

            axis.setZoomed(! zoomedOut);
            y[p].domain(domain);
            oa.ys[p].domain(domain);
            // scale domain is signed. currently .zoomedDomain is not, so maybeFlip().
            axis.setDomain(maybeFlip(domain, axis.flipped));

            /* was updatePaths true, but pathUpdate() is too long for RAF.
             * No transition required for RAF.
             */
            debounce(
              undefined,
              me.functionHandle('axisScaleChangedRaf', axisScaleChangedRaf),
              p, tRaf, false,  // args
              me.get('controls.view.debounceTime')
            );
            let brushExtent = oa.brushedRegions[p];
            if (brushExtents)
              // `that` refers to the brush g element, i.e. <g clip-path> within <g.brush>
              d3.select(that).call(y[p].brush.move,null);
            else if (brushExtent) {
              let gBrush = d3.event.sourceEvent.target.parentElement;
              let newBrushExtent = brushedDomain.map(function (r) { return yp(r);});
              console.log(brushExtent, brushedDomain, gBrush, newBrushExtent);
              d3.select(gBrush).call(yp.brush.move, newBrushExtent);
            }
          }
        }
      });
      debounce(
        undefined,
        me.functionHandle('showAxisZoomResetButtons', showAxisZoomResetButtons),
        svgContainer, getBrushExtents, zoom, bind(me, me.get('resetZooms')), axisName, me,  // args
        me.get('controls.view.debounceTime')
      );

      if (domainChanged) {
        // axisStackChanged(t);
        me.throttledZoomedAxis(axisName, t);
      }
    } // end of zoom()
    function axisScaleChangedRaf(p, t, updatePaths) {
      const job = 
      scheduler.schedule('affect', () => axisScaleChanged(p, t, updatePaths));
    }
    /** @param p  axisName
     * @param updatePaths true : also update foreground paths.
     */
    function axisScaleChanged(p, t, updatePaths)
    {
      let y = oa.y, svgContainer = oa.svgContainer;
      let yp = y[p],
      axis = oa.axes[p];
      if (yp && axis) {
        let yAxis = axis.axisSide(y[p]).ticks(me.axisTicks * axis.portion);
        let idName = axisEltId(p),
        axisS = svgContainer.select("#"+idName);
        if (t)
          axisS = axisS.transition(t)
          .duration(me.get('axisZoom.axisTransitionTime'));
        axisS.call(yAxis);
        if (updatePaths)
          pathUpdate(t);
        let axisGS = svgContainer.selectAll("g.axis#" + axisEltId(p) + " > g.tick > text");
        axisGS.attr("transform", yAxisTicksScale);
      }
    }

    function brushended() {
      // console.log("brush event ended");
      brushHelper(this);
    }


//- stacks-drag
    function dragstarted(start_d /*, start_index, start_group*/) {
      Stack.currentDrop = undefined;
      Stack.currentDrag = start_d;
      // unique_1_1_mapping = me.get('isShowUnique'); // disable until button click does not redraw all.
      /** disable this as currently togglePathColourScale() sets pathColourScale as a boolean
       * maybe have a pull-down selector because multi-value.
       use_path_colour_scale = me.get('pathColourScale'); */
      console.log("dragstarted", this, start_d/*, start_index, start_group*/);
      let cl = {/*self: this,*/ d: start_d/*, index: start_index, group: start_group, axisIDs: axisIDs*/};
      let svgContainer = oa.svgContainer;
      svgContainer.classed("axisDrag", true);
      d3.select(this).classed("active", true);
      console.log(d3.event.subject.fx, d3.event.subject.x);
      d3.event.subject.fx = d3.event.subject.x;
      let axisS = svgContainer.selectAll(".stack > .axis-outer");
      if (axisS && trace_stack >= 1.5)
        logSelection(axisS);
      /* Assign class current to dropTarget-s depending on their relation to drag subject.
       add class 'current' to indicate which zones to get .dragHover
       axis being dragged does not get .current
       middle targets on side towards dragged axis don't
       axes i in 1..n,  dragged axis : dg
       current if dg != i && (! middle || ((side == left) == (i < dg)))
       * for (i < dg), use x(d) < startx
       */
      axisS.selectAll('g.axis-outer > g.stackDropTarget').classed
      ("current",
       function(d /*, index, group*/)
       {
         let xd = x(d),
         /** d3.event has various x,y values, which are sufficient for this
          * purpose, e.g. x, subject.x, sourceEvent.clientX, sourceEvent.x */
         startX = d3.event.x,
         middle = this.classList.contains("middle"),
         left = this.classList.contains("left"),
         isCurrent =
           (d != cl.d) &&  (! middle || ((left) === (xd < startX)));
         // console.log("current classed", this, d3.event, d, /*index, group,*/ cl, xd, startX, middle, left, isCurrent);
         return isCurrent;
       });
    }

    /** @param  d (datum) name of axis being dragged.
     * @see stacks.log() for description of stacks.changed
     */
    function dragged(d) {
      /** Transition created to manage any changes. */
      let t;
      /** X distance from start of drag */
      let xDistance;
      let currentDropTarget = oa.currentDropTarget;
      if (dragging++ > 0) { console.log("dragged drop", dragging); dragging--; return;}
      if (! oa.svgContainer.classed("dragTransition"))
      {
        // if cursor is in top or bottom dropTarget-s, stack the axis,
        // otherwise set axis x to cursor x, and sort.
        let dropTargetEnd = currentDropTarget && currentDropTarget.classList.contains("end");

        const dropDelaySeconds = 0.5, milli = 1000;
        /** currentDrop references the axisName being dragged and the stack it is dropped into or out of. */
        let currentDrop = Stack.currentDrop,
        /** Use the start of the drag, or the most recent drop */
        xDistanceRef = (currentDrop && currentDrop.x) ? currentDrop.x.stack : d3.event.subject.fx,
        now = Date.now();
        if (trace_drag)
        {
          console.log("dragged xDistanceRef", d3.event.x, currentDrop && currentDrop.x, xDistanceRef);
          console.log("dragged", currentDrop, d);
        }
        /** true iff currentDrop is recent */
        let recentDrop = currentDrop && (now - currentDrop.dropTime < dropDelaySeconds * milli);

        if (true && recentDrop && dropTargetEnd)
        {
          console.log("dragged", currentDrop, currentDropTarget, now - currentDrop.dropTime);
        }
        if (! recentDrop)
        {
          if (dropTargetEnd)
          {
            let targetAxisName = currentDropTarget.axisName,
            top = currentDropTarget.classList.contains("top"),
            zoneParent = Stack.axisStackIndex2(targetAxisName);
            /** destination stack */
            let stack = oa.stacks[zoneParent.stackIndex];
            if (! stack.contains(d))
            {
              t = dragTransitionNew();
              /*  .dropIn() and .dropOut() don't redraw the stacks they affect (source and destination), that is done here,
               * with this exception : .dropIn() redraws the source stack of the axis.
               */
              stack.dropIn(d, zoneParent.axisIndex, top, t);
              breakPointEnableSet(1);
              deleteAfterDrag();
              // axisChangeGroupElt(d, t);
              collateStacks();
              // number of stacks has decreased - not essential to recalc the domain.
              Stack.log();
              stack.redraw(t);
            }
            // set x of dropped axisID
          }
          // For the case : drag ended in a middle zone (or outside any DropTarget zone)
          // else if d is in a >1 stack then remove it else move the stack
          else if ((! currentDrop || !currentDrop.out)
                   && ((xDistance = Math.abs(d3.event.x - xDistanceRef)) > vc.xDropOutDistance))
          {
            /** dragged axis, source stack */
            let axis = oa.axes[d], stack = axis.stack;
            if (currentDrop && currentDrop.stack !== stack)
            {
              console.log("dragged", d, currentDrop.stack, stack);
            }
            if (stack.axes.length > 1)
            {
              t = dragTransitionNew();
              stack.dropOut(d);
              Stack.log();
              // axisChangeGroupElt(d, t);
              collateStacks();
              /* if d is not in currentDrop.stack (=== stack), which would be a
               * program error, dropOut() could return false; in that case stack
               * redraw() may have no effect.
               */
              stack.redraw(t);
              /* if axis is dropped out to a new stack, redraw now for
               * continuity, instead of waiting until dragended().
               */
              axisRedrawText(axis);
              /* Following code will set o[d] and sort the Stack into location. */
            }
          }
        }
        /*
         else
         console.log("no currentDrop", d); */

        // console.log("dragged", dropTargetEnd, currentDropTarget, d);
      }

      // if (! dropTargetEnd)
      {
        let o = oa.o;
        // console.log("dragged o[d]", o[d], d3.event.x);
        o[d] = d3.event.x;
        // Now impose boundaries on the x-range you can drag.
        /** The boundary values */
        let dragLimit = oa.vc.dragLimit;
        if (o[d] < dragLimit.min) { o[d] = dragLimit.min; }
        else if (o[d] > dragLimit.max) { o[d] = dragLimit.max; }
      }
      //console.log(axisIDs + " " + o[d]);
      if (this === undefined)
      {
        console.log("dragged this undefined", d);
      }
      else
      {
        /* if (t === undefined)
         t = dragTransitionNew(); */
        draggedAxisRedraw(this, d, t);
      }
      if (stacks.changed & 0x01)
      {
        console.log("dragged", "stacks.changed 0x", stacks.changed.toString(16));
        stacks.changed ^= 0x01;
        axisStackChanged(undefined);
      }

      dragging--;
    } // dragged()

    /** Redraw the axis/axis which is being dragged.
     * Calls pathUpdate() which will mostly change the paths connected to the dragged axis;
     * but when dropIn/dropOut(), paths to other axes can be changed when stacking / adjacencies change.
     *
     * @param axisElt  node/DOM element corresponding of axis. this of dragged()
     * @param d axisName
     * @param t transition in which to make changes
     */
    function draggedAxisRedraw(axisElt, d, t)
    {
      let st0 = d3.select(axisElt);
      if (! st0.empty())
      {
        /* if (t === undefined)
         t = dragTransitionNew(); */
        // console.log("st0", st0._groups[0].length, st0._groups[0][0]);
        let st = st0; //.transition();  // t
        // st.ease(d3.easeQuadOut);
        // st.duration(dragTransitionTime);
        st.attr("transform", Stack.prototype.axisTransformO);
        // zoomed affects transform via path() : axisTransform.
        if (oa.drawOptions.continuousPathUpdate && (trace_path < 2))
          pathUpdate(t || st);
        //Do we need to keep the brushed region when we drag the axis? probably not.
        //The highlighted features together with the brushed regions will be removed once the dragging triggered.
        // st0.select(".brush").call(y[d].brush.move,null);
        //Remove all highlighted Features.
        axisFeatureCircles_selectAll().remove();
      }
    }

    /** Called when axisID has been dragged from one stack to another.
     * It is expected that the group element of the axis, g.axis-outer#<eltId(axisID)>,
     * needs to be moved from the source g.stack to destination.
     * @param axisID name/id of axis
     * @param t drag transition
     */
    function axisChangeGroupElt(axisID, t)
    {
      let aS_ = "g.axis-outer#" + eltId(axisID),
      aS = t.selectAll(aS_),
      gStack = aS._groups[0][0].parentNode;
      // let p = t.select(function() { return gStack; });
      // console.log("axisChangeGroupElt", axisID, t, aS_, aS, p);
      // compare with axis->stack
      let axis = oa.axes[axisID],
      stackID = axis.stack && axis.stack.stackID,
      /** destination Stack selection */
      dStack_ = "g.stack#" + stackEltId(axis.stack),
      dStackS = t.selectAll(dStack_),
      dStack = dStackS._groups[0][0], // equiv : .node()
      differentStack = gStack !== dStack;
      console.log("axisChangeGroupElt", axis, stackID, dStack_, dStackS, dStack, differentStack);

      // not currently used - g.stack layer may be discarded.
      if (false && differentStack)
      {
        var removedGAxis = aS.remove(),
        removedGAxisNode = removedGAxis.node();
        console.log("removedGAxis", removedGAxis, removedGAxisNode);
        let dStackN = dStackS.node();
        // tried .append, .appendChild(), not working yet.
        if (dStackN && dStackN.append)
          //  dStackN.append(removedGAxisNode);
          dStackN.append(function() { return removedGAxisNode;});
      }
    }

//- moved to utils/log-selection : fromSelectionArray(), logSelectionLevel(), logSelection()

//- paths
    function log_path_data(g)
    {
      let p3 = g.selectAll("g").selectAll("path");  // equiv : g.selectAll("g > path")
      console.log(p3._groups.length && p3._groups[0][0].__data__);
    }

    /** Update the paths connecting features present in adjacent stacks.
     * @param t undefined, or a d3 transition in which to perform the update.
     * @param flow  configures the data sources, processing, and output presentation
     */
    function pathUpdate_(t, flow)
    {
      let pathData = flow.pathData,
      unique_1_1_mapping = flow.direct ? false : (flow.unique ? true : 3),
      // pathDataInG = true,
      pathClass = flow.direct ? I : pathClassA;
      // "exported" to patham().
      pathDataIsLine = flow.direct;
      // console.log("pathUpdate");
      tracedAxisScale = {};  // re-enable trace, @see trace_scale_y
      /** flow.g may not be rendered yet; could use an empty selection in place
       * of flow.g, but flow.g is used several times here. */
      let flow_g = flow.gf;
      if (! flow_g) return;
      let g = flow_g ? flow_g.selectAll("g") :  d3.selectAll();
      let gn;
      /* if (unique_1_1_mapping)
       {*/
      if (trace_path)
        console.log("pathUpdate() pathData", flow.name, pathData.length, g.size()); // , pathData
      if (trace_path > 2)
        for (let pi=0; pi < pathData.length; pi++)
          log_ffaa(pathData[pi]);
      g = g.data(pathData);
      if (trace_path)
        console.log("exit", g.exit().size(), "enter", g.enter().size());
      if (trace_path && pathData.length === 0)
      {
        console.log("pathData.length === 0");
      }
      g.exit().remove();
      function log_foreground_g(selector)
      {
        let gg = oa.foreground.selectAll(selector);
        console.log("gg", selector, (trace_path > 2) ? gg._groups[0] : gg.node(), gg.size());
        if (trace_path > 2)
        {
          let gg0 = gg._groups[0];
          for (let gi=0; (gi < gg0.length) && (gi < 10); gi++)
          {
            log_ffaa(gg0[gi].__data__);
            console.log(gg0[gi]);
          }
        }
      }
      gn = g.enter().append("g");
      // insert data into path elements (each line of the "map" is a path)
      let pa;
      if (flow.direct)
      {
        if (trace_path)
          console.log(flow.name, gn.size(), gn);
        // pa = gn.append("path");
        // log_path_data(flow_g);
        let p2 = flow_g.selectAll("g").selectAll("path").data(path);
        // log_path_data(flow_g);
        // pa = g.selectAll("path").data(path)
        pa = p2.enter().append("path");
        let p2x = p2.exit();
        if (! p2x.empty())
        {
          console.log("pathUpdate_", "p2x", p2x._groups[0]);
          p2x.remove();
        }

      }
      else
      {
        pa =
          gn.append("path");
        let gx = g.exit();
        if (! gx.empty())
        {
          console.log("pathUpdate_", "gx", gx._groups[0]);
          gx.remove();
        }
        if (! pathDataInG)
          g.selectAll("path").data(pathData);
      }
      if (trace_path > 1)
        log_foreground_g("g." + flow.name + " > g > path");
      (pathDataInG ? gn : pa)
      //.merge()
        .attr("class", pathClass);
      //}
      // trace_path_count = 10;
      let
        path_ = unique_1_1_mapping ? (pathDataInG ? pathUg : pathU) : path,
      /** The data of g is feature name, data of path is SVG path string. */
      keyFn =function(d) { let featureName = featureNameOfPath(this); 
                           console.log("keyFn", d, 'parent', this, featureName); 
                           return featureName; };
      /* The ffaa data of path's parent g is accessed from path attribute
       * functions (i.e. style(stroke), classed(reSelected), gKeyFn(), d, etc.);
       * alternately it could be stored in the path's datum and accessed
       * directly.  This would be needed if there were multiple path's within a
       * g elt.  There is incomplete draft of this (changing the data of path to
       * ffaa) in branch devel-path-data),
       *
       * Here the SVG line string is calculated by path_ from the parent g data,
       * and the attr d function is identity (I) to copy the path datum.
       */
      if (false)
      {
        let gd = /*g.selectAll("path")*/gn/*pa*/.data(path_/*, keyFn*/);
        let en = gd.enter();
        if (trace_stack > 1)
        {
          let ex = gd.exit();
          if (ex.size())
            console.log("gd.exit()", ex);
          if (en.size())
            console.log("gd.enter()", en);
        }
        gd.exit().remove();
      }
      if (trace_path && pathData.length > 0 &&  g.size() === 0)
      {
        console.log("pathUpdate", pathData.length, g.size(), gn.enter().size(), t);
      }
      let gp;
      if ((trace_path > 1) && (pathData.length != (gp = d3.selectAll(".foreground > g." + flow.name + " > g > path")).size()))
      {
        console.log("pathData.length", pathData.length, "!= gp.size()", gp.size());
      }

      // .merge() ...
      if (true)
      {
        /** attr d function has not changed, but the data has.
         * even where the datum is the same, the axes may have moved.
         * So update all paths.
         */
        let t1= (t === undefined) ? oa.foreground.select(" g." + flow.name)  : flow_g.transition(t),
        p1 = t1.selectAll("g > path"); // pa
        p1.attr("d", pathDataIsLine ? I : path_);
        if (trace_path > 3)
        {
          console.log(t1.nodes(), t1.node(), p1.nodes(), p1.node());
          log_path_data(flow_g);
        }
        setupMouseHover(pa);
      }
      else
      {
        if (t === undefined) {t = d3; }
        t.selectAll(".foreground > g." + flow.name + "> g > path").attr("d", function(d) { return d; });
        setupMouseHover(
          flow_g.selectAll("g > path")
        );
      }
      pathColourUpdate(pa, flow);
    }
    if (! this.pathUpdateFlow)
    {
      /** Call pathUpdate_().  Used for calls from collate-paths.
       * @param t transition, which is likely to be undefined here.
       */
      this.pathUpdateFlow = function(t, flow) {
        if (me.get('pathJoinClient'))
          pathUpdate_(t, flow);
      };
      this.on('pathUpdateFlow', this, this.pathUpdateFlow);
    }

    /** call pathUpdate(t) for each of the enabled flows. */
    function pathUpdate(t)
    {
      if (me.get('pathJoinClient'))
      d3.keys(flows).forEach(function(flowName) {
        let flow = flows[flowName];
        if (flow.enabled)
          pathUpdate_(t, flow);
      });
    }
//- paths-classes
    /** Get the data corresponding to a path element, from its datum or its parent element's datum.
     * In the case of using aliases, the parent g's data is [f, f, axis, axis, ...] "ffaa".
     */
    function dataOfPath(path)
    {
      let pa = pathDataInG
        ? path.parentElement || path._parent /* EnterNode has _parent not parentElement */
        : path,
      da = pa.__data__;
      return da;
    }
    /** Get the featureName of a path element, from its corresponding data accessed via dataOfPath().
     */
    function featureNameOfPath(path)
    {
      let da = dataOfPath(path),
      featureName = featureNameOfData(da);
      return featureName;
    }
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
      chrName = axisName2Chr(axisName),
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
      let classes;
      /** d is path SVG line text if pathDataIsLine */
      let da = dataOfPath(pathElt);
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
        let [feature0, feature1, a0, a1] = da;
        let classSet = colouredAg(a0.axisName, feature0) || colouredAg(a1.axisName, feature1);
        classes = classSet;
      }
      return classes;
    }
    function pathColourUpdate(gd, flow)
    {
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
            let da = dataOfPath(this);
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
          let da = dataOfPath(this);
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
            console.log("class", this, featureNameOfPath(this), featureScaffold, scaffold, c, d);
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

//- axis/stacks-drag
    function deleteAfterDrag() {
      let stacks = oa.stacks;
      if (trace_stack)
        console.log("deleteAfterDrag", stacks.toDeleteAfterDrag);

      if (stacks.toDeleteAfterDrag !== undefined)
      {
        stacks.toDeleteAfterDrag.delete();
        stacks.toDeleteAfterDrag = undefined;
      }
      Stack.verify();
      // stacks change has not yet been rendered, so don't compare against DOM here.
      // stacksAxesDomVerify(stacks, oa.svgContainer);
    }
    /** recalculate all stacks' Y position.
     * Recalculate Y scales.
     * Used after drawing / window (height) resize.
     */
    function stacksAdjustY(t)
    {
      oa.stacks.forEach(function (s) { s.calculatePositions(); });
      oa.stacks.axisIDs().forEach(function(axisName) {
        axisScaleChanged(axisName, t, false);
      });
    }
    /** recalculate stacks X position and show via transition
     * @param changedNum  true means the number of stacks has changed.
     * @param t undefined or transition to use for axisTransformO change
     * @see stacks.log() for description of stacks.changed
     */
    function stacksAdjust(changedNum, t)
    {
      updateAxisTitleSize(undefined);
      /* updateAxisTitleSize() uses vc.axisXRange but not o, so call it before collateO(). */
      if (changedNum)
        collateO();
      collateStacks();
      if (changedNum)
      {
        if (t === undefined)
          t = d3.transition().duration(dragTransitionTime);
        t.selectAll(".axis-outer").attr("transform", Stack.prototype.axisTransformO);
        if (trace_stack > 2)
        {
          let a=t.selectAll(".axis-outer");
          a.nodes().map(function(c) { console.log(c);});
          console.log('stacksAdjust', changedNum, a.nodes().length);
        }
        if (oa.svgContainer)
          oa.stacks.forEach(function (s) { s.redrawAdjacencies(); });
      }
      // could limit this to axes for which dataBlocks has changed
      // axisShowExtendAll();
      // pathUpdate() uses flow.gf, which is set after oa.foreground.
      if (oa.foreground && ysLength())
      {
        pathUpdate(t);
        countPathsWithData(oa.svgRoot);
      }
      else {
        console.log('stacksAdjust skipped pathUpdate', changedNum, oa.foreground, ysLength());
      }

      if (stacks.changed & 0x10)
      {
        console.log("stacksAdjust", "stacks.changed 0x", stacks.changed.toString(16));
        stacks.changed ^= 0x10;
        if (oa.svgContainer === undefined)
          later(function () {
            axisStackChanged(t);
          });
        else
          axisStackChanged(t);
      }

      return t;
    }
    if (! oa.axisApi.stacksAdjust)
      oa.axisApi.stacksAdjust = stacksAdjust;
    function dragended(/*d*/) {
      deleteAfterDrag();
      let stacks = oa.stacks;
      stacks.sortLocation();

      // in the case of dropOut(),
      // number of stacks has increased - need to recalc the domain, so that
      // x is defined for this axis.
      //
      // Order of axisIDs may have changed so need to redefine x and o.
      updateXScale();
      // if caching, recalc : collateAxisPositions();
      
      /* stacks.changed only needs to be set if sortLocation() has changed the
       * order, so for an optimisation : define stacks.inOrder() using reduce(),
       * true if stacks are in location order.
       */
      stacks.changed = 0x10;
      let t = stacksAdjust(true, undefined);
      // already done in xScale()
      // x.domain(axisIDs).range(axisXRange);
      // stacksAdjust() calls redrawAdjacencies().  Also :
      /* redrawAdjacencies() is called from .redraw(), and is mostly updated
       * during dragged(), but the stacks on either side of the origin of the
       * drag can be missed, so simply recalc all here.
       */

      d3.select(this).classed("active", false);
      let svgContainer = oa.svgContainer;
      svgContainer.classed("axisDrag", false);
      d3.event.subject.fx = null;
      Stack.currentDrag = undefined;
      /** This could be updated during a drag, whenever dropIn/Out(), but it is
       * not critical.  */
      vc.xDropOutDistance_update(oa);


      if (svgContainer.classed("dragTransition"))
      {
        console.log("dragended() dragTransition, end");
        dragTransition(false);
      }
      stacks.log();
      setCount('dragended');
    }
    

//- axis-brush-zoom
    /** flip the value of features between the endpoints
     *
     * This is done for each of selectedAxes[], except if param features is
     * defined, it is done just for selectedAxes[0].
     *
     * @param features is an array of feature names, created via (zoom) brush,
     * and input via text box
     * features are passed by selected-markers.js : flipRegion(), but not
     * view-controls.js:flipRegion().
     */
    this.set('draw_flipRegion', function(features) {
      let brushedMap, zm,
      selectedAxes = oa.selectedAxes;
      let limits;
      if (selectedAxes.length === 0)
        console.log('draw_flipRegion', 'selectedAxes is empty', selectedAxes);
      /* axes = oa.selectedAxes;
        brushedMap = axes && axes.length && axes[axes.length-1]; */
      else if ((brushedMap = selectedAxes[0]) === undefined)
        console.log('draw_flipRegion', 'selectedAxes[0] is undefined', selectedAxes);
      else if ((zm = oa.z[brushedMap]) === undefined)
        console.log('draw_flipRegion', 'z[', brushedMap, '] is undefined', selectedAxes, oa.z);
      else
      {
        if (features && features.length)
        {
          limits = features2Limits(features);
          // possibly could apply to all of selectedAxes[], currently does just selectedAxes[0]
          flipRegionInLimits(brushedMap, limits);
          flipRegionSignalAxis(brushedMap);
        }
        else
        {
          console.log(oa.selectedAxes);
          selectedAxes.forEach(function(p, i) {
            // p is selectedAxes[i], including brushedMap === selectedAxes[0]
            limits = axisBrushedDomain(p, i);
            //  oa.brushedRegions[brushedMap];
            console.log('flipRegion', p, i, brushedMap, limits);
            /* Generally for p in selectedAxes[], brushedRegions[p] is
             * defined; but if axis 'Reset' the brush is cleared but
             * the axis remains selected. */
            if (limits) {
              flipRegionInLimits(p, limits);
              flipRegionSignalAxis(p);
            }
          });
        }
        /** Flag the flip event for the axis - increment axis1d flipRegionCounter.
         * @param axisID  brushedMap / selectedAxes[i]
         */
        function flipRegionSignalAxis(axisID) {
        let axis = Stacked.getAxis(axisID),
        axis1d = axis && axis.axis1d;
        if (axis1d)
          axis1d.incrementProperty('flipRegionCounter');
        }
      }
      function features2Limits()
      {
        /** the first and last features have the minimum and maximum position
         * values, except where flipRegion has already been applied. */
        let limits = [undefined, undefined];
        limits = features
          .reduce(function(limits_, fi) {
            // console.log("reduce", fi, limits_, zm[fi]);
            // feature aliases may be in the selection and yet not in the map
            let zmi = zm[fi];
            if (zmi)
            {
              let l = zmi.location;
              if (limits_[0] === undefined || limits_[0] > l)
                limits_[0] = l;
              if (limits_[1] === undefined || limits_[1] < l)
                limits_[1] = l;
            }
            // console.log(zmi, l, limits_);
            return limits_;
          }, limits);
        // console.log("limits", limits);
        let 
          f0  = features[0], f1  = features[features.length-1];
        console.log("features2Limits", /*features, zm,*/ f0 , f1, limits);
        return limits;
      }

      function flipRegionInLimits(p, locationRange)
      {
        let
        /** delta of the locationRange interval */
        rd = locationRange[1] - locationRange[0],
        invert = function (l)
        {
          let i = rd === 0 ? l : locationRange[1] + (locationRange[0] - l);
          // console.log("invert", l, i);
          return i;
        };
        console.log("flipRegionInLimits", locationRange, rd);
        let axis = stacks.axesP[p],
        blocks = axis && axis.blocks;
        console.log(axis, blocks);
        (blocks || []).map(function (block) {
          zm = oa.z[block.axisName];
          console.log(block.axisName, zm);
          d3.keys(zm).forEach(function(feature) {
            if (! isOtherField[feature]) {
              let feature_ = zm[feature], fl = feature_.value;
              if (subInterval(fl, locationRange))
                fl.forEach((v, i) => { feature_.value[i] = invert(v); });
            }
          });
        });
        pathUpdate(undefined);
      }
    });

//- paths-classes
    this.set('clearScaffoldColours', function() {
      console.log("clearScaffoldColours");
      featureScaffold = oa.featureScaffold = {}, scaffolds = new Set(), scaffoldFeatures = {};
      aliasGroupClasses = {};
      pathColourUpdate(undefined, undefined);
    });

//- axis-menu
    let apTitleSel = "g.axis-outer > text";
      function glyphIcon(glyphiconName) {
        return ''
          + '<span class="glyphicon ' + glyphiconName + '" aria-hidden=true></span>';
      }
    /** 
     * @param useGlyphIcon  selects glyphicon or html icon. optional param : undefined implies false
     */
    function iconButton(className, id, htmlIcon, glyphiconName, href, useGlyphIcon)
    {
        return ''
        + '<button class="' + className + '" id="' + id + '" href="' + href + '">'
        + (useGlyphIcon ? glyphIcon(glyphiconName) : htmlIcon)
        + '</button>';
    }


    /** The given block has become unviewed, e.g. via manage-explorer.
     * Update the stacks and the display.
     * @param blockId may be a reference or child block; if the former then delete its axis.
     */
    function blockIsUnviewed(blockId) {
      let axisName = blockId;
      let axis, sBlock;

      /* prior to unview of the parent block of a non-empty axis, the child data blocks are unviewed.
       * This is a verification check.
       */
      axis = oa.axes[axisName];
      console.log("blockIsUnviewed", axisName, axis);
      if (axis && axis.blocks.length > 1)
      {
        console.log(
          'blockIsUnviewed', blockId,
          'is the parent block of an axis which has child data blocks', axis.blocks, axis);
        axis.log();
        // augment blockId with name and map axis.blocks to names.
        let cn = oa.cmName[blockId], blockName = cn && (cn.mapName + ':' + cn.chrName);
        let blockNames = axis.blocks.map(function (block) { return block.longName(); } );
        alert(blockId + '/' + blockName + ' is the parent block of an axis which has child data blocks ' + blockNames);
      }

      axis = Stacked.getAxis(blockId);
      if (axis) {
        sBlock = axis.removeBlockByName(blockId);
        console.log(axis, sBlock);
        axis.log();
        // delete oa.stacks.blocks[blockId];
        /* if the axis has other blocks then don't remove the axis.
         * -  To handle this completely, the adoption would have to be reversed -
         * i.e. split the children into single-block axes.
         */
        if (axis.blocks.length)
          axis = undefined;
      }

      // verify : oa.axes[axisName]
      if (axis)
      {
        // removeBlockByName() is already done above

        // this can be factored with : deleteButtonS.on('click', ... )
        let stack = axis && axis.stack;
        // axes[axisName] is deleted by removeStacked1() 
        let stackID = Stack.removeStacked(axisName);
        console.log('removing axis', axisName, sBlock, stack, stackID);
        stack.log();
        deleteAxisfromAxisIDs(axisName);
        removeAxisMaybeStack(axisName, stackID, stack);
        // already done in removeStacked1() : delete oa.axesP[axisName];

      // already done, removeMap() triggers blockIsUnviewed()  : me.send('mapsToViewDelete', axisName);

      // filter axisName out of selectedFeatures and selectedAxes
      let mapChrName = axis.blocks[0]?.block?.brushName;
      selectedFeatures_removeAxis(axisName, mapChrName);
      sendUpdatedSelectedFeatures();
      }
      else
      {
        updateAxisTitles();
        updateAxisTitleSize(undefined);
        /* The if-then case above calls removeAxisMaybeStack(), which calls stacksAdjust();
         * so here in the else case, use a selection of updates from stacksAdjust() to
         * ensure that pathData is updated.
         */
        collateStacks();
        if (oa.foreground && ysLength())
        {
          pathUpdate(/*t*/ undefined);
          countPathsWithData(oa.svgRoot);
        }
        pathUpdate(undefined);
      }

    }


    /** Setup hover menus over axis titles.
     * So far used just for Delete
     * @see based on similar configurejQueryTooltip()
     */
    function  configureAxisTitleMenu(block) {
      let options = me.get('urlOptions'),
      /** the __data__ of the element triggering the menu was axisName, but is
       * now block; the axis and stack lookups below could now go more directly
       * via block. */
      axisName = block.axisName,
      /** PerpendicularAxis */
      dotPlot = options && options.dotPlot,
      /** The first stage of split axes is enabled by options.splitAxes1,
       * the remainder by options.splitAxes.
       * In development, splitAxes1 is enabled by default; in production it is disabled by default. 
       */
      splitAxes1 = options && options.splitAxes1 || (config.environment !== 'production');
      if (trace_gui)
      console.log("configureAxisTitleMenu", axisName, this, this.outerHTML);
        let node_ = this;
        let showMenuFn = me.functionHandle('showMenu', showMenu);
      node_.onclick = showMenuFn;
      /** Even though showMenuFn is constant, jQuery.on does : handlers.push(handleObj)
       * each call, perhaps it avoids duplicate registrations only when selector
       * is passed.
       * So node_.onclick is used instead of :
        $(node_)
        .on('click', showMenuFn);
        */
      /** @param e DOM event */
      function showMenu(e) {
        let block = this.__data__;
        if (block.axis.blocks[0] !== block) {
          dLog('showMenu', 'data block', block, block.axis.blocks);
          block = block.axis.blocks[0];
        }
        /** defined when called via jQuery.on(click) */
        let jQueryEventInfo = e.originalEvent && [e.originalEvent.path, e.originalEvent.srcElement, e.handleObj.type];
        dLog('showMenu', this, axisName, this.__data__, this.parentElement, this.parentElement.parentElement,
             e, jQueryEventInfo);
        me.sendAction('selectBlock', block.block);

        let menuActions = oa.axisApi.menuActions;
        if (! menuActions) {
          oa.axisApi.menuActions = {axisDelete, axisFlip, axisPerpendicular, axisExtend};
        } else if (! menuActions.axisDelete) {
          /** menuActions is assigned to only here and in
           * configureAxisSubTitleMenu(), and these 2 sets of actions don't
           * overlap, so '=' would be equivalent to '||='.
           */
          menuActions.axisDelete        ||= axisDelete;
          menuActions.axisFlip          ||= axisFlip;
          menuActions.axisPerpendicular ||= axisPerpendicular;
          menuActions.axisExtend        ||= axisExtend;
        }
        /** If the axis-menu is already displayed on a different axis,
         * reposition it to align with the axis of the clicked block title.
         */
        if (me.get('menuAxis') && (me.get('menuAxis') !== block)) {
          me.set('menuAxis', undefined);
          later(() => me.set('menuAxis', block));
        } else {
          me.set('menuAxis', block);
        }
        return false; /* for preventDefault(), stopPropagation() */
      }
      if (false) {undefined
        .popover({
            trigger : "manual", // hover", // "click focus",
          sticky: true,
          delay: {show: 200, hide: 1500},
          container: 'div#holder',
          placement : "auto bottom",
          // title : axisName,
          html: true,
          /*
           *	╳	9587	2573	 	BOX DRAWINGS LIGHT DIAGONAL CROSS
           *	⇅	8645	21C5	 	UPWARDS ARROW LEFTWARDS OF DOWNWARDS ARROW
           *	↷	8631	21B7	 	CLOCKWISE TOP SEMICIRCLE ARROW
           *	⇲	8690	21F2	 	SOUTH EAST ARROW TO CORNER
           */
          content : ""
            + iconButton("DeleteMap", "Delete_" + axisName, "&#x2573;" /*glyphicon-sound-7-1*/, "glyphicon-remove-sign", "#")
            + iconButton("FlipAxis", "Flip_" + axisName, "&#x21C5;" /*glyphicon-bell*/, "glyphicon-retweet", "#")
            + 
            (dotPlot ?
             iconButton("PerpendicularAxis", "Perpendicular_" + axisName, "&#x21B7;" /*glyphicon-bell*/, "glyphicon-retweet", "#") : "")
            +
            (splitAxes1 ?
             iconButton("ExtendMap", "Extend_" + axisName, "&#x21F2;" /*glyphicon-star*/, "glyphicon-arrow-right", "#")  : "")
        })
                 }
        // .popover('show');
      
      /*
        .on("shown.bs.popover", function(event) {
          if (trace_gui)
            console.log("shown.bs.popover", event, event.target);
        });
      */
          // button is not found when show.bs.popover, but is when shown.bs.popover.
          // Could select via id from <text> attr aria-describedby="popover800256".
      /*
          let deleteButtonS = d3.select("button.DeleteMap");
          if (trace_gui)
            console.log(deleteButtonS.empty(), deleteButtonS.node());
          deleteButtonS
            .on('click', );
      */
      /** lexical context enclosed by menuActions functions :
       * functions :
       *  deleteAxisfromAxisIDs
       *  removeBrushExtent
       *  removeAxisMaybeStack
       *  selectedFeatures_removeAxis
       *  sendUpdatedSelectedFeatures
       *  maybeFlip
       *  axisScaleChanged
       * variables :
       *  oa
       *  Stacked
       *  me
       */
      function axisDelete (axisName  /*buttonElt, i, g*/) {
              console.log("delete", axisName, this);
        // this overlaps with the latter part of blockIsUnviewed()
              // and can be factored with that.
              let axis = oa.axes[axisName], stack = axis && axis.stack;
              // axes[axisName] is deleted by removeStacked1() 
              let stackID = Stack.removeStacked(axisName);
              deleteAxisfromAxisIDs(axisName);
              let sBlock = oa.stacks.blocks[axisName];
              let block = sBlock.block;
              console.log('sBlock.axis', sBlock.axis);
              sBlock.setAxis(undefined);
              removeBrushExtent(axisName);
              removeAxisMaybeStack(axisName, stackID, stack);
              me.send('removeBlock', axisName);
              // filter axisName out of selectedFeatures and selectedAxes
              selectedFeatures_removeAxis(axisName, sBlock?.block?.brushName);
              sendUpdatedSelectedFeatures();
            }
      /*
          let flipButtonS = d3.select("button.FlipAxis");
          flipButtonS
            .on('click', ); */
      function axisFlip (axisName /*buttonElt , i, g*/) {
              console.log("flip", axisName, this);
              /** Handle the possibility that axisName may have been adopted by
               * another axis after this callback registration. */
              let axis = Stacked.getAxis(axisName),
              ya = oa.y[axisName = axis.axisName], ysa=oa.ys[axisName],
              domain = maybeFlip(ya.domain(), true);
              axis.flipped = ! axis.flipped;
              /** if the axis is brushed, show the brush position updated by flip.
               * Instead of using range (inverted to domain via
               * axisRange2Domain); axisBrushShowSelection() uses
               * axisBrush.brushedDomain (as commented in showResize)
               */
              let range = oa.brushedRegions[axisName];

              if (axis.axis1d)
                axis.axis1d.toggleProperty('flipped');
              ya.domain(domain);
              ysa.domain(domain);

              /* after y domain update, map brushed domain to new position.  */
              if (range) {
                dLog('axisFlip', axisName, range);
                let gBrush = axisBrushSelect(oa.svgContainer, axisName);
                axisBrushShowSelection(axisName, gBrush);
              }

              let t = oa.svgContainer.transition().duration(750);
              axisScaleChanged(axisName, t, true);
            }
      /*
          let perpendicularButtonS = d3.select("button.PerpendicularAxis");
          perpendicularButtonS
            .on('click', ); */
      function axisPerpendicular (axisName /*buttonElt , i, g*/) {
              console.log("perpendicular", axisName, this);
              let axis = Stacked.getAxis(axisName);
              axis.perpendicular = ! axis.perpendicular;

              oa.showResize(true, true);
            }

      /*
          let extendButtonS = d3.select("button.ExtendMap");
          if (trace_gui)
            console.log(extendButtonS.empty(), extendButtonS.node());
          extendButtonS
            .on('click', ); */
      function axisExtend (axisName /*buttonElt , i, g*/) {
              console.log("extend", axisName, this);
              let axis = Stacked.getAxis(axisName), stack = axis && axis.stack;
              // toggle axis.extended, which is initially undefined.
              axis.extended = ! axis.extended;
              // axisShowExtend(axis, axisName, undefined);
              me.send('enableAxis2D', axisName, axis.extended);
            }


    }

    /*------------------------------------------------------------------------*/

    /** Register functions for block actions in axis-menu (menuActions).
     */
    function menuActions_block() {
        /** see also comment in configureAxisTitleMenu() */
        let menuActions = oa.axisApi.menuActions;
        if (! menuActions) {
          oa.axisApi.menuActions = {blockUnview, blockVisible}
        } else if (! menuActions.blockUnview) {
          menuActions.blockUnview  ||= blockUnview;
          menuActions.blockVisible ||= blockVisible;
        }
    };

    /** Setup hover menus over axis child data block sub-titles.
     * Based on similar @see configureAxisTitleMenu()
     * @param block (Block) is the __data__ of the <tspan>-s
     */
    function  configureAxisSubTitleMenu(block) {
      if (trace_gui)
      console.log("configureAxisSubTitleMenu", block.axisName, this, this.outerHTML);
        let node_ = this;
      let blockR = block.block,
      title = blockR
        ? blockR.get('namespace') + ' ' + blockR.get('scope')
        : block.longName();
      if (true /* use axis-menu.hbs, not $.popover*/) {
        menuActions_block();
      } else
      if ($(node_) .popover)
        $(node_)
        .popover({
          /* would like to use .axis-menu as a selector in css,
           * but 'class' is not effective; maybe in a later version. refn :
           * https://github.com/twbs/bootstrap/pull/23874 */
          class : 'axis-menu',
            trigger : "hover",
          sticky: true,
          delay: {show: 200, hide: 1500},
          container: 'div#holder',
          placement : "auto bottom",
          title : title,
          html: true,

          content : ""
            + iconButton("DeleteMap", "Delete_" + block.axisName, "&#x2573;" /*glyphicon-sound-7-1*/, "glyphicon-remove-sign", "#")
            + iconButton("VisibleAxis", "Visible_" + block.axisName, "&#x1F441;" /*Unicode Character 'EYE'*/, "glyphicon-eye-close", "#", true)
          // glyphicon-eye-open	
        })
        // .popover('show');
      
      /*
        .on("shown.bs.popover", function(event) {
          if (trace_gui)
            console.log("shown.bs.popover", event, event.target);

          let deleteButtonS = d3.select("button.DeleteMap");
          if (trace_gui)
            console.log(deleteButtonS.empty(), deleteButtonS.node());
          deleteButtonS
            .on('click',*/
      /*buttonElt , i, g*/ /*);

          let visibleButtonS = d3.select("button.VisibleAxis");
          if (trace_gui)
            console.log(visibleButtonS.empty(), visibleButtonS.node());

          visibleButtonS
            .on('click', */
     /*buttonElt , i, g*/ /*);

        });*/
    }

    /** un-view the block.  (axis-menu : block) */
    function blockUnview (block) {
              console.log("blockUnview (deleteMap / removeBlock)", block.axisName, this);
              // this will do : block.block.setViewed(false);
              me.send('removeBlock', block.block);
    }
    /** Toggle the visibility of the block.  (axis-menu : block)
     * Call functions to make corresponding update to display of axis title, selected features, paths.
     */  
    function blockVisible (block) {
              console.log("blockVisible (VisibleAxis), visible", block.visible, block.longName(), this);
              block.visible = ! block.visible;
              /* copy to Ember Block object, for axis-menu to use as dependency in if. */
              block?.block?.set('visible', block.visible);

              updateAxisTitles();
              updateAxisTitleSize(undefined);
              collateStacks();  // does filterPaths();

              if (! block.visible) {
                selectedFeatures_removeBlock(block);
              } else {
                let ab = oa.axisApi?.axisFeatureCirclesBrushed;
                ab && ab();
              }
                sendUpdatedSelectedFeatures();

              pathUpdate(undefined);
    }
    

    /*------------------------------------------------------------------------*/

    /** Record the viewport Width and Height for use as dependencies of
     * @see resizeEffect()
     */
    function recordViewport(w, h) {
      later(
        () => 
          ! this.isDestroying &&
      this.setProperties({
        viewportWidth : w,
        viewportHeight : h
      }));
    };

      /** Render the affect of resize on the drawing.
       * @param widthChanged   true if width changed
       * @param heightChanged   true if height changed
       * @param useTransition  undefined (default true), or false for no transition
       */
    function showResize(widthChanged, heightChanged, useTransition)
    {
        console.log('showResize', widthChanged, heightChanged, useTransition);
      console.log('showResize',   me.get('viewportWidth'), oa.vc.viewPort.w, me.get('viewportHeight'), oa.vc.viewPort.h);
      let viewPort = oa && oa.vc && oa.vc.viewPort;
      if (viewPort)
        /* When visibility of side panels (left, right) is toggled, width of
         * those panels changes in a transition (uses flex in CSS), and hence
         * resize() -> showResize() are called repeatedly in close succession,
         * with slightly changing width.
         * Minimise the impact of this by using debounce, and .toFixed(), since
         * changes < 1 pixel aren't worth a re-render.
         */
        debounce(
          me,
          recordViewport,
          viewPort.w.toFixed(),
          viewPort.h.toFixed(),
          500);
        updateXScale();
        collateO();
        me.axesShowXOffsets();
        if (widthChanged)
          updateAxisTitleSize(undefined);
        let 
          duration = useTransition || (useTransition === undefined) ? 750 : 0,
        t = oa.svgContainer.transition().duration(duration);
        let graphDim = oa.vc.graphDim;
        oa.svgRoot
        .attr("viewBox", oa.vc.viewBox.bind(oa.vc))
          .attr('height', graphDim.h /*"auto"*/);

      /* axes removed via manage-view : removeBlock don't remove any brush of
       * that axis from brushedRegions, so check for that here.
       * This check could be done when services/data/blocks:viewed.[] updates.
       */
      Object.keys(oa.brushedRegions).forEach(
        (refBlockId) => { if (! oa.axes[refBlockId]) removeBrushExtent(refBlockId); } 
      );
      /** As in zoom(), note the brushedDomains before the scale change, for
       * updating the brush selection position.
       * This could be passed to axisBrushShowSelection() and used in place of
       * axisBrush.brushedDomain; the current intention is to shift to using
       * just axisBrush.brushedDomain and brushedRegions / brushExtents can be retired.
       * oa.brushedRegions is equivalent to getBrushedRegions() - could use that for verification.
       */
      let brushedDomains = {};
      Object.entries(oa.brushedRegions).forEach(
        // similar to axisBrushedDomain().
        ([refBlockId, region]) => brushedDomains[refBlockId] = axisRange2Domain(refBlockId, region)
      );
      dLog('brushedDomains', brushedDomains);

      // recalculate Y scales before pathUpdate().
        if (heightChanged)
          stacksAdjustY(t);

      // for stacked axes, window height change affects the transform.
        if (widthChanged || heightChanged)
        {
        t.selectAll(".axis-outer").attr("transform", Stack.prototype.axisTransformO);
          // also xDropOutDistance_update (),  update DropTarget().size
          pathUpdate(t /*st*/);
        }

        if (heightChanged)
        {
          // let traceCount = 1;
          oa.svgContainer.selectAll('g.axis-all > g.brush > clipPath > rect')
            .each(function(d) {
              let a = oa.axesP[d],
              ya = oa.y[d],
              yaRange = ya.range();
              // dLog('axis-brush', this, this.getBBox(), yaRange);
              // see also brushClip().
              d3.select(this)
              // set 0 because getting y<0, probably from brushClip() - perhaps use [0, yRange] there.
                .attr("y", 0)
                .attr("height", yaRange[1]);
            });
          oa.svgContainer.selectAll('g.axis-all > g.brush > g[clip-path]')
            .each(function(d) {
              /* if (traceCount-->0) console.log(this, 'brush extent', oa.y[d].brush.extent()()); */
              let a = oa.axesP[d],
              ya = oa.y[d],
              b = ya.brush;
              // draw the brush overlay using the changed scale
              d3.select(this).call(b);
              /* if the user has created a selection on the brush, move it to a
               * new position based on the changed scale. */
              axisBrushShowSelection(d, this);
            });
          if (DropTarget.prototype.showResize) {
            DropTarget.prototype.showResize();
          }
        }
        later( function () {
          if (me.isDestroying) { return; }
          /* This does .trigger() within .later(), which seems marginally better than vice versa; it works either way.  (Planning to replace event:resize soon). */
          if (widthChanged || heightChanged)
            try {
              /** draw-map sends 'resized' event to listening sub-components using trigger().
               * It does not listen to this event. */
              me.trigger('resized', widthChanged, heightChanged, useTransition);
            } catch (exc) {
              console.log('showResize', 'resized', me, me.resized, widthChanged, heightChanged, useTransition, graphDim, brushedDomains, exc.stack || exc);
            }
          // axisShowExtendAll();
          showSynteny(oa.syntenyBlocks, undefined); });
      };

//- brush-menu
    function setupToggle(checkboxId, onToggle)
    {
      let 
      checkbox = $("#" + checkboxId);
      checkbox.on('click', function (event) {
        let checked = checkbox[0].checked;
        console.log(checkboxId, checked, event.originalEvent);
        onToggle(checked);
      });
    }
//- draw-controls
    function setupTogglePathUpdate()
    {
      /* initial value of continuousPathUpdate is true, so .hbs has : checked="checked" */
      setupToggle
      ("checkbox-togglePathUpdate",
      function (checked) {
        oa.drawOptions.continuousPathUpdate = checked;
      }
      );
    }
    /** The Zoom & Reset buttons (g.btn) can be hidden by clicking the 'Publish
     * Mode' checkbox, now called 'Show Zoom/Reset buttons' and the logic is inverted.
     * This provides a clear view of the visualisation
     * uncluttered by buttons and other GUI mechanisms
     */
    function setupToggleModePublish()
    {
      setupToggle
      ("checkbox-toggleModePublish",
      function (checked) {
        let svgContainer = oa.svgContainer;
        console.log(svgContainer._groups[0][0]);
        /** the checkbox is 'Show', so hide if ! checked. */
        svgContainer.classed("publishMode", ! checked);
      }
      );
    }
    function setupToggleShowPathHover()
    {
      /* initial value of showPathHover is false */
      setupToggle
      ("checkbox-toggleModePathHover",
      function (checked) {
        oa.drawOptions.showPathHover = checked;
      }
      );
    }
    function setupToggleShowAll()
    {
      /* initial value of showAll is true, so .hbs has : checked="checked" */
      setupToggle
      ("checkbox-toggleShowAll",
      function (checked) {
        oa.drawOptions.showAll = checked;
        pathUpdate(undefined);
      }
      );
    }
    function setupToggleShowSelectedFeatures()
    {
      /* initial value of showSelectedFeatures is true, so .hbs has : checked="checked" */
      setupToggle
      ("checkbox-toggleShowSelectedFeatures",
      function (checked) {
        oa.drawOptions.showSelectedFeatures = checked;
        pathUpdate(undefined);
      }
      );
    }
    /** The stroke -opacity and -width can be adjusted using these sliders.
     * In the first instance this is for the .manyPaths rule, but
     * it could be used to factor other rules (.faded, .strong), or they may have separate controls.
     * @param varName string : name of css variable to set the input value into,
     * or otherwise a function to call with the input value.
     * (this will be split into 2 functions with different signatures, the varName version calling the function version)
     * @param factor  scale the input (integer) value down by factor.
     * (perhaps change this to # decimal-digits, and display a value with decimal places)
     */
    function setupInputRange(inputId, varName, factor)
    {
      let input = $("#" + inputId);
      input.on('input', function (event) {
        let value = input[0].value / factor;
        console.log(inputId, value, event.originalEvent, oa.svgRoot._groups[0][0]);
        if (typeof varName == "string")
          setCssVariable(varName, value);
        else
          later(function () { varName(value); });
      });
    }
    function setupPathOpacity()
    {
      setupInputRange("range-pathOpacity", "--path-stroke-opacity", 100);
    }
    function setupPathWidth()
    {
      setupInputRange("range-pathWidth", "--path-stroke-width", 100);
    }
    function setupVariousControls()
    {
      setupToggleShowPathHover();
      setupTogglePathUpdate();
      setupToggleShowAll();
      setupToggleShowSelectedFeatures();
      setupPathOpacity();
      setupPathWidth();

      setupToggleModePublish();
    }

//- moved to flows-controls.js : flows_showControls()

    if (newRender)
    {
    setupVariousControls();
    }

//- draw-map
    /** After chromosome is added, draw() will update elements, so
     * this function is used to update d3 selections :
     * svgRoot, svgContainer, foreground, flows[*].g
     */
    function updateSelections() {
      let svgRoot = oa.svgRoot, svgContainer = oa.svgContainer,
      foreground = oa.foreground;
      console.log(
        "svgRoot (._groups[0][0])", svgRoot._groups[0][0],
        ", svgContainer", svgContainer._groups[0][0],
        ", foreground", foreground._groups[0][0]);
      svgRoot = d3.select('#holder > svg');
      svgContainer = svgRoot.select('g');
      foreground = svgContainer.select('g.foreground');
      console.log(
        "svgRoot (._groups[0][0])", svgRoot._groups[0][0],
        ", svgContainer", svgContainer._groups[0][0],
        ", foreground", foreground._groups[0][0]);
      //- moved code to app/utils/draw/flow-controls.js: updateSelections_flowControls() (new function)
    };

//- paths-classes, should be getUsePathColour() ?
    function getUsePatchColour()
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

//- moved to flows-controls.js : Flow.prototype.ExportDataToDiv()


  },   // draw()

  //----------------------------------------------------------------------------

  /** Redraw all stacks.
   * Used when change of axisTicksOutside.
   */
  stacksRedraw()
  {
    dLog('stacksRedraw');
    if (this.oa.svgContainer) {
      let t = this.oa.svgContainer.transition().duration(750);
      this.oa.stacks.forEach(function (s) { s.redraw(t); });
    }
  },
  /** re-apply axisTransformO(), which uses the axis x scales oa.o */
  axesShowXOffsets() {
    let 
    oa = this.oa,
    t = oa.svgContainer;
    t.selectAll(".axis-outer").attr("transform", Stack.prototype.axisTransformO);
  },


//--------------------------------------------------------------------------

  /** Provide a constant function value for use in .debounce(). */
  triggerZoomedAxis : function (args) {
    this.trigger("zoomedAxis", args);
  },
  throttledZoomedAxis : function (axisID, t) {
    /* this delivers zoomed() via 
     * axis-2d : zoomedAxis() throttle-> sendZoomed() -> zoomed (in-axis.js)
     * used by axis-ld and axis-charts (which can use drawContentEffect instead).
     throttle(this, this.triggerZoomedAxis, [axisID, t], 400);
     */
  },

  //----------------------------------------------------------------------------


  updateSyntenyBlocksPosition : task(function * () {
    dLog('updateSyntenyBlocksPosition', this.oa.syntenyBlocks.length);
    if (this.oa.axisApi.showSynteny) {
      this.oa.axisApi.showSynteny(this.oa.syntenyBlocks, undefined);
    }
    yield timeout(100);
  }).keepLatest(),

  //----------------------------------------------------------------------------

  didInsertElement() {
    this._super(...arguments);

    if (! $.popover && $.fn.popover) {
      dLog('didInsertElement initialise $.popover from .fn');
      $.popover = $.fn.popover;
      $.button = $.fn.button;	// maybe not used.
      $.tab = $.fn.tab;
    }
    // eltWidthResizable('.resizable');

    // initial test data for axis-tracks - will discard this.
    let oa = this.get('oa');
    oa.tracks  = [{start: 10, end : 20, description : "track One"}];
    this.set('toolTipHovered', false);
    later(() => {
      $('.left-panel-shown')
        .on('toggled', (event) => this.readLeftPanelToggle() );
      /** .draggable() is provided by jquery-ui. ember-cli-jquery-ui is not
       * updated, and .make-ui-draggable is not enabled for any elements
       * currently; As needed, can instead use
       * e.g. github.com/mharris717/ember-drag-drop for .tooltip.ember-popover.
       * $('.make-ui-draggable').draggable();  */
    });
  },

  drawEffect : computed('data.[]', 'resizeEffect', function () {
    let me = this;
    let data = this.get('data');
    throttle(function () {
      /** when switching back from groups/ route to mapview/, this may be called
       * before oa.axisApi is initialised in draw(), */
      if (me.oa.axisApi) {
      /** viewed[] is equivalent to data[], apart from timing differences.  */
      let viewed = me.get('blockService.viewed'),
      /** create axes for the reference blocks before the data blocks are added. */
      referencesFirst = viewed.sort((a,b) => {
        let aHasReference = !!a.get('referenceBlock'),
        bHasReference = !!b.get('referenceBlock');
        return aHasReference === bHasReference ? 0 : aHasReference ?  1 : -1;
      });
      referencesFirst.forEach((block) => me.oa.axisApi.ensureAxis(block.id));
      }
      me.draw(data, 'didRender');
    }, 1500);

    highlightFeature_drawFromParams(this);
  }),
  resizeEffect : computed(
    /* viewportWidth and viewportHeight will change as a result of changes in
     * stacksWidthChanges.{left,right}, so these dependencies could be
     * consolidated (checking that the dependencies change after the element size
     * has changed).
     */
    'stacksWidthChanges.@each', 'viewportWidth', 'viewportHeight',
    function () {
      let
      stacksWidthChanges = this.get('stacksWidthChanges'),
      viewportWidth = this.get('viewportWidth'),
      viewportHeight = this.get('viewportHeight'),
      result = {
        stacksWidthChanges, viewportWidth, viewportHeight
      };
      let prev = this.get('resizePrev');
      this.set('resizePrev', result);
      if (prev) {
        delete result.changed;
        let changed = compareFields(prev, result, compareViewport);
        result.changed = changed;
      }
      dLog('resizeEffect', result);
    if (false) // currently the display is probably smoother with the debounce; later after tidying up the resize structure this direct call may be better.
      this.get('resize').apply(this.get('oa'), [/*transition*/true]);
    else
      debounce(this.get('oa'), this.get('resize'), [/*transition*/true], 500);
      return result;
  }),

  /** for CP dependency.  Depends on factors which affect the horizontal (X) layout of stacks.
   * When this CP fires, updates are required to X position of stacks / axes, and hence the paths between them.
   * @return value is for devel trace
   */
  stacksWidthChanges : computed(
    'blockService.stacksCount', 'splitAxes.[]',
    /** panelLayout is mapview .layout */
    'panelLayout.left.visible', 'panelLayout.right.visible',
    function () {
      let count = stacks.length;
      // just checking - will retire stacks.stacksCount anyway.
      if (count != stacks.stacksCount?.count)
        console.log('stacksWidthChanges',  count, '!=', stacks.stacksCount);
      let leftPanelShown = this.readLeftPanelToggle(),
      current = {
        stacksCount : count,
        splitAxes : this.get('splitAxes').length,
        // this.get('panelLayout.left.visible') is true, and does not update
        left : leftPanelShown,
        right : this.get('panelLayout.right.visible')
      };
      console.log('stacksWidthChanges', current);
      return current;
    }),
  /** Read the CSS attribute display of left-panel to determine if it is shown / visible.  */
  readLeftPanelToggle() {
      let leftPanel = $('#left-panel'),
      /** leftPanel.hasClass('left-panel-shown') is always true; instead the
       * <div>'s display attribute is toggled between flex and none.
       * using jQuery .toggle() applied to button.left-panel-{shown,hidden},
       * in toggleLeftPanel(), via left-panel.hbs action of button.panel-collapse-button.
       * This could be made consistent with right panel, but planning to use golden-layout in place of this anyway.
       *
       * .attributeStyleMap is part of CSS Typed OM; is in Chrome, not yet Firefox.
       * https://github.com/Fyrd/caniuse/issues/4164
       * https://developer.mozilla.org/en-US/docs/Web/API/CSS_Typed_OM_API
       */
      haveCSSOM = leftPanel[0].hasAttribute('attributeStyleMap'),
      leftPanelStyleDisplay = haveCSSOM ?
        leftPanel[0].attributeStyleMap.get('display').value :
        leftPanel[0].style.display,
      leftPanelShown = leftPanelStyleDisplay != 'none'
    ;
    dLog('readLeftPanelToggle', leftPanel[0], leftPanelShown);
    /* The returned value is used only in trace.  This attribute .leftPanelShown is observed by resize()
 */
    this.set('leftPanelShown', leftPanelShown);
    return leftPanelShown;
  },

  /** @return true if changes in #stacks or split axes impact the width and horizontal layout.
   * (maybe dotPlot / axis.perpendicular will affect width also)
   */
  stacksWidthChanged() {
    /* can change this to a CP, merged with resize() e.g. resizeEffect(), with
     * dependencies on 'blockService.stacksCount', 'splitAxes.[]'
     */
    let previous = this.get('previousRender'),
    now = {
      stacksCount : stacks.length,   // i.e. this.get('blockService.stacksCount'), or oa.stacks.stacksCount.count
      splitAxes : this.get('splitAxes').length
    },
    changed = ! isEqual(previous, now);
    if (changed) {
      console.log('stacksWidthChanged', previous, now);
      later(() => ! this.isDestroying && this.set('previousRender', now));
    }
    return changed;
  },

  resize : observer(
    'panelLayout.left.visible',
    'panelLayout.right.visible',
    'leftPanelShown',
    'controls.view.showAxisText',
    /* axisTicksOutside doesn't resize, but a redraw is required (and re-calc could be done) */
    'controls.view.axisTicksOutside',
    /* after 'controls.view.extraOutsideMargin' changes, axis x offsets are re-calculated.  related : 'oa.vc.axisXRange' */
    'controls.view.extraOutsideMargin',
    /* ChangeCount represents 'xOffsets.@each.@each', */
    'xOffsetsChangeCount',
    /** split-view : sizes of the components adjacent the resize gutter : 0: draw-map and 1 : tables panel. */
    'componentGeometry.sizes.0',
    'controls.window.tablesPanelRight',
    function() {
      console.log("resize", this, arguments);
        /** when called via .observes(), 'this' is draw-map object.  When called
         * via  window .on('resize' ... resizeThisWithTransition() ... resizeThis()
         * ... Ember.run.debounce(oa, me.resize, ), 'this' is oa.
         */
        let calledFromObserve = (arguments.length === 2),
      layoutChanged = calledFromObserve,
      /** This can be passed in along with transition in arguments,
       * when ! calledFromObserve.
       */
      windowResize = ! calledFromObserve,
            oa =  calledFromObserve ? this.oa : this;
      let me = calledFromObserve ? this : oa.eventBus;
      let redrawAxes = arguments[1] === 'controls.view.axisTicksOutside';
    // logWindowDimensions('', oa.vc.w);  // defined in utils/domElements.js
    function resizeDrawing() { 
      // if (windowResize)
        eltResizeToAvailableWidth(
          /*bodySel*/ 'div.ember-view > div > div.body > div',
          /*centreSel*/ '.resizable');
      oa.vc.calc(oa);
      let
        drawMap = oa.eventBus,
      widthChanged = (oa.vc.viewPort.w != oa.vc.viewPortPrev.w) || drawMap.stacksWidthChanged(),
      heightChanged = oa.vc.viewPort.h != oa.vc.viewPortPrev.h;

      // rerender each individual element with the new width+height of the parent node
      // need to recalc viewPort{} and all the sizes, (from document.documentElement.clientWidth,Height)
      // .attr('width', newWidth)
      /** Called from .resizable : .on(drag) .. resizeThis() , the browser has
       * already resized the <svg>, so a transition looks like 1 step back and 2
       * steps forward, hence pass transition=false to showResize().
      */
      let useTransition = layoutChanged;
      oa.showResize(widthChanged, heightChanged, useTransition);
    }
        console.log("oa.vc", oa.vc, arguments);
        if (oa.vc)
        {
            if (redrawAxes) {
              this.stacksRedraw();
            }
            if (false && ! layoutChanged)
                // Currently debounce-d in resizeThis(), so call directly here.
                resizeDrawing();
            else
            {
                console.log(arguments[1], arguments[0]);
                /* debounce is used to absorb the progressive width changes of
                 * the side panels when they open / close (open is more
                 * progressive).
                 * After the values panelLayout.{left,right}.visible change, DOM
                 * reflow will modify viewport width, so the delay helps with
                 * waiting for that.
                 */
                debounce(resizeDrawing, 300);
            }
        }

    }
  )
  /* could include in .observes() : 'panelLayout.left.tab', but the tab name should not affect the width.
   * (currently the value of panelLayout.left.tab seems to not change - it is just 'view').
   * stacksWidthChanges.{left,right} are equivalent to leftPanelShown and panelLayout.right.visible,
   * so there is some duplication of dependencies, since resizeEffect() depends on stacksWidthChanges.@each
   */


});

