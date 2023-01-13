import { on } from '@ember/object/evented';
import $ from 'jquery';
import {
  once,
  later,
  debounce,
  bind,
  throttle
} from '@ember/runloop';
import { computed, get, set as Ember_set, setProperties, observer } from '@ember/object';
import { alias, filterBy } from '@ember/object/computed';
import Evented from '@ember/object/evented';
import Component from '@ember/component';
import { inject as service } from '@ember/service';
import { A as Ember_array_A } from '@ember/array';



/* global require */


/*----------------------------------------------------------------------------*/

import config from '../config/environment';
import { EventedListener } from '../utils/eventedListener';

import {
  chrData, cmNameAdd,
  AxisChrName,
  makeMapChrName,
  makeIntervalName,
 } from '../utils/utility-chromosome';

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
import { configureHover, configureHorizTickHover_orig } from '../utils/hover';
import { axisFontSize, AxisTitleLayout } from '../utils/draw/axisTitleLayout';
import { AxisTitleBlocksServers } from '../utils/draw/axisTitleBlocksServers_tspan';

import {
  AxisTitle,
} from '../utils/draw/axisTitle';

import {
  AxisBrushZoom,
} from '../utils/draw/axisBrush';

import {  Axes, maybeFlip, maybeFlipExtent,
          ensureYscaleDomain,
          /*yAxisTextScale,*/  yAxisTicksScale,  yAxisBtnScale, yAxisTitleTransform,
          eltId, stackEltId, axisEltId, eltIdAll, axisEltIdTitle,
          moveOrAdd,
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
import { intervalsEqual, intervalIntersect } from '../utils/interval-calcs';
import { round_2, checkIsNumber } from '../utils/domCalcs';
import { Object_filter, compareFields } from '../utils/Object_filter';
import {
  name_chromosome_block,
  name_position_range,
  isOtherField
} from '../utils/field_names';
import { breakPoint, breakPointEnableSet } from '../utils/breakPoint';
import { Flow } from "../utils/flows";
import {
  flowButtonsSel,
  configurejQueryTooltip,
  flows_showControls
} from "../utils/draw/flow-controls";
import {
         collateData,
         addPathsToCollation, addPathsByReferenceToCollation,
       } from "../utils/draw/collate-paths";

import {
  unique_1_1_mapping 
} from '../utils/paths-config';

import { storeFeature } from '../utils/feature-lookup';

import AxisDraw from '../utils/draw/axis-draw';
import { PathClasses } from '../utils/draw/path-classes';
import { PathDataUtils } from '../utils/draw/path-data';
import { PathInfo } from '../utils/draw/path-info';

import { selectedBlocksFeaturesToArray } from '../services/data/selected';




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

/*----------------------------------------------------------------------------*/

let trace_dataflow = 0;

const dLog = console.debug;

Object.filter = Object_filter;



/*----------------------------------------------------------------------------*/

//- moved to "../utils/draw/flow-controls.js" : flowButtonsSel, configurejQueryTooltip()

/*----------------------------------------------------------------------------*/


//- moved to graph-frame.js : compareViewport()



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
      this.off('pathsByReference', addPathsByReferenceToCollation);
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
      /* Could invert this control by using the same PathClasses instance as is
       * used for .configurePathColour() which sets .colouredFeaturesChanged,
       * and could instead set an enable flag, and here call
       * pathClasses.colouredFeaturesChanged().
       */
      let colouredFeaturesChanged = self.get('colouredFeaturesChanged');
      if (colouredFeaturesChanged)
        colouredFeaturesChanged(features);
    });
  },

  draw_flipRegion : undefined,
  flipRegion: function(features) {
    console.log("flipRegion in components/draw-map.js");
    let axisBrushZoom = AxisBrushZoom(this.oa);
    let flipRegion = axisBrushZoom.draw_flipRegion;
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
  /*
   * stacks.axes1d is [axisID] -> axis-1d.
   * Equivalent : Object.values(this.stacks.axes1d).
   */
  axis1dArray : alias('oa.axisApi.stacksView.axes1d.axis1dArray'),

  axisTicks : alias('controls.view.axisTicks'),

  /** initialised to default value in components/panel/view-controls.js */
  sbSizeThreshold : alias('controls.view.sbSizeThreshold'),

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
        let featuresAsArray = selectedBlocksFeaturesToArray(selectedFeatures);
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
          updateRange(a.y, a.ys, oa.vc, a);
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

    closeToolTipA() {
      const pathInfo = PathInfo(this.oa);
      pathInfo.closeToolTip();
    }

  },

  getAxis1d(axisID) {
    let axes1d = this.get('axes1d') || this.get('oa.stacks.axes1d');
    let axis1d = axes1d[axisID];
    return axis1d;
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
      this.set('drawControlsLifeC', true);

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


    /*------------------------------------------------------------------------*/



    if (oa.__lookupGetter__('stacks'))
      this.set('stacks', stacks);
    else
      oa.stacks = stacks;
    if (stacks.nextStackID === undefined) {
      stacks.init(oa);
    }
    // stacks.axes[] is a mix of Stacked & Block; shouldn't be required & planning to retire it in these changes.
    oa.axes = stacks.axesP;
    oa.axesP = stacks.axesP;
    /** Refresh axisApi when draw-map object instance changes, so the functions
     * do not refer to closures in the destroyed instance. */
    let instanceChanged;
    let axisBrushZoom = AxisBrushZoom(oa);
    if (! oa.axisApi.drawMap || (instanceChanged = oa.axisApi.drawMap.isDestroying)) {
      const axisApiAdd = {
                    cmNameAdd,
                    axisIDAdd,
                    stacksAxesDomVerify : function (unviewedIsOK = false) { stacksAxesDomVerify(stacks, oa.svgContainer, unviewedIsOK); } ,
                    updateSyntenyBlocksPosition : () => this.get('updateSyntenyBlocksPosition').perform(),
                    drawMap : this,  // for debug trace / check.
                       // temporary additions - the definitions will be moved out.
                    sendUpdatedSelectedFeatures,
                    selectedFeatures_clear : () => this.get('selectedService').selectedFeatures_clear(),
                    deleteAxisfromAxisIDs,
                   };
      setProperties(oa.axisApi, axisApiAdd);
    }
    const axisTitle = AxisTitle(oa);
    const axisChrName = AxisChrName(oa);
    const pathDataUtils = PathDataUtils(oa);
    const pathInfo = PathInfo(oa);
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
    //- moved to graph-frame.js as setupViewport()
    oa.graphFrame.setupViewport();

    if (! oa.axisTitleLayout)
      oa.axisTitleLayout = new AxisTitleLayout();

    if (oa.axes2d === undefined)
      oa.axes2d = new Axes(oa);

    //- moved to utils/draw/path-classes.js : pathColourDefault, use_path_colour_scale, path_colour_scale_domain_set, path_colour_scale
    //- moved to utils/draw/viewport.js : xDropOutDistance_update()


    /** A simple mechanism for selecting a small percentage of the
     * physical maps, which are inconveniently large for debugging.
     * This will be replaced by the ability to request subsections of
     * chromosomes in API requests.
     */
    const filter_location = false;


    //- moved to path-classes : showScaffoldFeatures (showScaffoldMarkers), showAsymmetricAliases

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
        cmName[axis] = {
          mapName : c.mapName, chrName : c.chrName,
          parent: parentName,
          name : c.name, range : c.range,
          scope: c.scope, featureType: c.featureType,
          dataset,
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

    //- moved to view-controls : drawOptions
    if (oa.drawOptions === undefined)
    {
      // replaced in view-controls init()
      oa.drawOptions = {};
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
    foreground;
    // brushActives = [],

    //- moved to ../utils/draw/axis.js :  eltId(), axisEltId(), highlightId()

    //- moved to ../utils/domElements.js :  eltClassName()

    //- moved to ../utils/domCalcs.js : checkIsNumber()

    /*------------------------------------------------------------------------*/
    // inRange() replaced by a later / equivalent version available from utils/draw/zoomPanCalcs.js
    //-    import { inRange } from "../utils/graph-maths.js";
    //-    import { } from "../utils/elementIds.js";

    //- moved to utils/utility-chromosome.js : mapChrName2Axis(), axisName2Chr(), axisName2MapChr(), makeMapChrName(), makeIntervalName(),

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

    let selectedAxes = oa.selectedAxes || (oa.selectedAxes = this.get('selectedService.selectedAxes'));;
    let selectedFeatures = oa.selectedFeatures ||
        (oa.selectedFeatures = this.get('selectedService.blocksFeatures'));

    /** planning to move selectedFeatures out to a separate class/component;
     * these 2 functions would be actions on it. */
    //Reset the selected Feature region, everytime an axis gets deleted
    function sendUpdatedSelectedFeatures()
    {
      if (oa.drawOptions.showSelectedFeatures)
        me.send('updatedSelectedFeatures', selectedFeatures);
    }
    //- moved to axes-1d.js : selectedFeatures_removeAxis(), selectedFeatures_removeBlock()

    collateData();


    //- moved to axisBrush.js as zoomBehaviorSetup()

    //--------------------------------------------------------------------------

    /* Until f81e5367 there was a capability here for adopting axes : if a data
     * block was viewed without its parent, it was displayed on an axis, and
     * when the parent was viewed, that block / axis was adopted by the parent
     * axis.  While there might be some use for displaying a data block by
     * itself, there is no planned requirement for it - currently the parent is
     * automatically viewed when a child data block is viewed.
     *
     * Also removed : ensureAxis(); now the axes are generated from
     * components/draw/axes-1d.hbs based on .axesP
     * It included matchParentAndScope(), whose role is now covered by
     * mapBlocksByReferenceAndScope() et al in services/data/block.js
     *
     * Also removed : axisWidthResizeRight() : add width change to the x translation of axes to the right of this one.
     * Used instead : the x scale and a transition seems to give a smooth and equivalent result.
     */

    //--------------------------------------------------------------------------


    let x = stacks.x;
    oa.axisApi.updateXScale?.();
    //let dynamic = d3.scaleLinear().domain([0,1000]).range([0,1000]);
    //console.log(axis.scale(y[axisIDs))
    //- stacks_for_axisIDs(); //- added during split

    //- moved to utils/stacks.js: oa.xScaleExtend = xScale();

    //- moved code to graph-frame : renderFrame()

    //- moved updateRange() to utils/stacksLayout

    //-    import { } from "../utils/paths.js";

    //-    import { } from "../utils/intervals.js";

    //- moved to path-classes : featureScaffold, scaffolds, scaffoldFeatures, intervals, intervalNames, intervalTree, scaffoldTicks

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
    oa.syntenyBlocks || (oa.syntenyBlocks = []);

    //- moved to path-classes : configurePathColour()
    const pathClasses = PathClasses(oa);
    pathClasses.configurePathColour();

    //- moved to utils/draw/axis.js : maybeFlip(), maybeFlipExtent()

    //-components/stacks 
    /* for each axis :
     */
    oa.stacks.axisIDs().forEach(function(d) {
      let a = oa.axes[d],
      y = a.axis.axis1d.y;
    });

    //- moved to graph-frame.js as renderFrame()
    oa.graphFrame.renderFrame();

    let options = this.get('urlOptions');

    //- moved to graph-frame.js : setCssVariable()

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

    //- moved to utils/draw/path-classes.js : pathClassA()
    //- moved to utils/draw/path-data.js : featureNameOfData(), data_text()

    //- moved to graph-frame.js : flowName(), flowHidden(), if-block as renderForeground()
    oa.graphFrame.renderForeground();


    // moved to ../utils/draw/axis.js : stackEltId()

    //- moved DropTarget to utils/draw/drop-target.js (considered : components/axis)

//- moved to ../utils/draw/axis.js : yAxisTextScale(),  yAxisTicksScale(),  yAxisBtnScale()

      //- moved to utils/draw/axisBrush.js : setupBrushZoom(), brushClipSize()

    /*------------------------------------------------------------------------*/

    //- moved toolTip to utils/draw/path-info.js
    pathInfo.setupToolTip();

//- moved to stacks-view.js : axisStackChanged_(), axisStackChanged()

//-components/paths
    //- moved to utils/draw/path-info.js : 
    /* setupMouseHover(), toolTipMouseOver(), toolTipMouseOut(), closeToolTip(),
     * setupToolTipMouseHover(), handleMouseOver(), hidePathHoverToolTip(),
     * handleMouseOut(),
     */

//- axis

    function zoomAxis(){
      console.log("Zoom : zoomAxis()");
    }
    function refreshAxis(){
      console.log("Refresh");
    }

    /*------------------------------------------------------------------------*/
    //- moved to utils/draw/feature-info.js : showTickLocations()
    //- moved to hover.js : configureHorizTickHover() as configureHorizTickHover_orig

    //--------------------------------------------------------------------------
    //- moved showSynteny() to utils/draw/synteny-blocks-draw.js  (related : components/draw/synteny-blocks.js)
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

    //- moved to utils/draw/path-data.js :
    /* blockO(), featureLine2(), inside(), pointSegment(), featureLineS2(),
     * featureLineS3(), featureLineS(), lineHoriz(), featureLine(), path(),
     * pathU(), pathUg(), pathAliasGroup(), inRangeI(), inRangeI2(),
     * featureAliasesText(), pathFeatureStore(), featureNameInRange(),
     * featureInRange(), patham(), axisFeatureTick(), patham2(), featureY_(),
     * featureY2(), log_path_data(), pathUpdate_(), log_foreground_g(),
     * pathUpdate(), dataOfPath(), featureNameOfPath(),
     */


//- moved to axisBrush.js (considered axis-brush-zoom.js) : getBrushExtents() ... brushended()
/*
getBrushExtents(),
    getBrushedRegions(), axisBrushedDomain(), axisRange2DomainFn(), axisRange2Domain(), axisBrushShowSelection(),
    brushHelper(), resetZooms(), resetBrushes(), removeBrushExtent(), resetZoom(),
    axisFeatureCircles_selectAll(), handleFeatureCircleMouseOver(), handleFeatureCircleMouseOut(), brushEnableFeatureHover(), zoom(), axisScaleChangedRaf(), axisScaleChanged(), brushended(), 
*/


//- moved to  stacks-drag.js : dragstarted(), dragged(),  draggedAxisRedraw(),  axisChangeGroupElt(), dragended()

//- moved to utils/log-selection : fromSelectionArray(), logSelectionLevel(), logSelection()


    //- moved to utils/draw/path-classes.js : colouredAg(), classFromSet(), locationClasses(), pathClasses(), pathColourUpdate(), scaffoldLegendColourUpdate(),


//- moved  deleteAfterDrag() to stacks-drag (considered axis/)

//- moved to stacks-view.js : stacksAdjustY(), stacksAdjust()

//- moved to axisBrush.js (considered axis-brush-zoom) : draw_flipRegion(), (containing) features2Limits(), flipRegionInLimits(),


//- moved to path-classes : clearScaffoldColours()

//- after 60cc0419 : removed apTitleSel, glyphIcon(), iconButton()

//- removed blockIsUnviewed(), replaced by stacksAdjust() and axis-1d : axisTitleFamily() ...
/* ... and axis-menu-actions.js : axisDelete() and blockVisible() do
 * selectedFeatures_remove{Axis,Block}; sendUpdatedSelectedFeatures() to update
 * selectedService .blocksFeatures and .selectedFeatures
 */

    //- e3c3d5a3 moved extract of configureAxisTitleMenu() to axisTitle.js and removed configureAxisSubTitleMenu()



    /*------------------------------------------------------------------------*/

    //- moved to graph-frame.js : recordViewport(), showResize()

   //- moved extracts to view-controls, replaced these functions using oninput=(action )  :  setupToggle(), setupTogglePathUpdate(), setupToggleModePublish(), setupToggleShowPathHover(), setupToggleShowAll(), setupToggleShowSelectedFeatures(), setupPathOpacity(), setupPathWidth(), setupVariousControls(),

//- moved to flows-controls.js : flows_showControls()


//- draw-map

  //- moved to graph-frame.js : updateSelections()


//- moved to path-classes : getUsePatchColour() as getUsePathColour()

//- moved to flows-controls.js : Flow.prototype.ExportDataToDiv()


  },   // draw()

  //----------------------------------------------------------------------------

  //- moved to stacks-view.js : stacksRedraw(), axesShowXOffsets()


  //- moved to axisBrush.js : triggerZoomedAxis, throttledZoomedAxis,

  //- moved to graph-frame.js : updateSyntenyBlocksPosition()

  //----------------------------------------------------------------------------

  didInsertElement() {
    this._super(...arguments);

    const oa = this.oa;
    // oa.graphFrame = new GraphFrame(oa);
    oa.graphFrame.readLeftPanelShown();
    //- moved to graph-frame.js : $.popover setup, readLeftPanelShown()
  },

  //- moved to graph-frame.js : drawEffect(), resizeEffect(), stacksWidthChanges(), readLeftPanelToggle(), stacksWidthChanged(), resize()


  /* could include in .observes() : 'panelLayout.left.tab', but the tab name should not affect the width.
   * (currently the value of panelLayout.left.tab seems to not change - it is just 'view').
   * graph-frame:
   * stacksWidthChanges.{left,right} are equivalent to leftPanelShown and panelLayout.right.visible,
   * so there is some duplication of dependencies, since resizeEffect() depends on stacksWidthChanges.@each
   */


});

