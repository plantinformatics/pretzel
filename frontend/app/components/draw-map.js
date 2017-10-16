import Ember from 'ember';
import compileSearch from 'npm:binary-search-bounds';
console.log("compileSearch", compileSearch);
import createIntervalTree from 'npm:interval-tree-1d';
console.log("createIntervalTree", createIntervalTree);

import { chrData } from '../utils/utility-chromosome';
import { eltWidthResizable, noShiftKeyfilter } from '../utils/domElements';


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

let trace_updatedStacks = true;
let trace_promise = 1;

let breakPointEnable = 1;
function breakPoint()
{
  if (breakPointEnable > 0)
  {
    console.log("breakPoint", breakPointEnable);
    --breakPointEnable;
  }
}

let flowButtonsSel = "div.drawing-controls > div.flowButtons";


function configurejQueryTooltip(oa, node) {
  d3.selectAll(node + " > div.flowButton")
    .each(function (flowName) {
      // console.log("configurejQueryTooltip", flowName, this, this.outerHTML);
      let node_ = this;
      Ember.$(node_)
      /*
        .tooltip({
          template: '<div class="tooltip" role="tooltip">'
            + '<div class="tooltip-arrow"></div>'
            + '<div class="tooltip-inner"></div>'
            + '</div>',
          title: "title" + flowName
        })
       */
      /* Either 1. show when shift-click, or 2. when hover
       * For 1, un-comment this on(click) and popover(show), and comment out trigger & sticky.
        .on('click', function (event) {
          console.log(event.originalEvent.type, event.originalEvent.which, event);
          // right-click : event.originalEvent.which === 3
          if (event.originalEvent.shiftKey)
            Ember.$(event.target)
       */
        .popover({
          trigger : "hover",
          sticky: true,
          delay: {show: 200, hide: 3000},
          placement : "auto bottom",
          title : flowName,
          html: true,
          /* Possibly some variation between jQuery function .tooltip() and
           * bootstrap popover (used here) : may take parameter template in
           * place of content.
           * This is using : bower_components/bootstrap/js/popover.js, via bower.json
           */
          content : ""
            + '<button class="ExportFlowData" id="Export:' + flowName + '" href="#">Export</button>'
          /*
           })
           .popover("show")
           ;
           */
        })
        .on("shown.bs.popover", function(event) {
          console.log("shown.bs.popover", "Export", event, event.target);
          let exportButtonS = d3.select("button.ExportFlowData");
          console.log(exportButtonS.empty(), exportButtonS.node());
          exportButtonS
            .on('click', function (buttonElt /*, i, g*/) {
              console.log("Export", flowName, this);
              let flow = oa.flows[flowName];
              // output flow name and data to div.pathDataTable
              flow.ExportDataToDiv("div.ExportFlowData");
            });
        });
    });
};





export default Ember.Component.extend({
  classNames: ['draw-map-container'],

  store: Ember.inject.service('store'),

  /*------------------------------------------------------------------------*/

  /** Used for receiving colouredMarkers from selected-markers.js,
   * and flipRegion, ...
   */
  feedService: (console.log("feedService"), Ember.inject.service('feed')),

  listen: function() {
    let f = this.get('feedService');
    console.log("listen", f);
    if (f === undefined)
      debugger;
    else {
      f.on('colouredMarkers', this, 'updateColouredMarkers');
      f.on('clearScaffoldColours', this, 'clearScaffoldColours');
      f.on('flipRegion', this, 'flipRegion');
      f.on('resetZooms', this, 'resetZooms');
    }
  }.on('init'),

  // remove the binding created in listen() above, upon component destruction
  cleanup: function() {
    let f = this.get('feedService');
    f.off('colouredMarkers', this, 'updateColouredMarkers');
    f.off('clearScaffoldColours', this, 'clearScaffoldColours');
    f.off('flipRegion', this, 'flipRegion');
    f.off('resetZooms', this, 'resetZooms');
  }.on('willDestroyElement'),

  /** undefined, or a function to call when colouredMarkers are received  */
  colouredMarkersChanged : undefined,

  updateColouredMarkers: function(markers) {
    console.log("updateColouredMarkers in components/draw-map.js");
    let self = this;
    this.get('scroller').scrollVertical('#holder', {
      duration : 1000,
      // easing : 'linear', // default is swing
      offset : -60
    }).then(function () {
      let colouredMarkersChanged = self.get('colouredMarkersChanged');
      if (colouredMarkersChanged)
        colouredMarkersChanged(markers);
    });
  },

  draw_flipRegion : undefined,
  flipRegion: function(markers) {
    console.log("flipRegion in components/draw-map.js");
    let flipRegion = this.get('draw_flipRegion');
    if (flipRegion)
      flipRegion(markers);
  },

  /*------------------------------------------------------------------------*/
  
  scroller: Ember.inject.service(),

  axisData : [{marker: "A1", position: 11}, {marker: "A2", position: 12}],

  /*------------------------------------------------------------------------*/

  actions: {
    updatedSelectedMarkers: function(selectedMarkers) {
      let markersAsArray = d3.keys(selectedMarkers)
        .map(function (key) {
          return selectedMarkers[key].map(function(marker) {
            //marker contains marker name and position, separated by " ".
            var info = marker.split(" ");
            return {Chromosome:key,Marker:info[0],Position:info[1]};
          });
        })
        .reduce(function(a, b) { 
          return a.concat(b);
        }, []);
      // console.log(markersAsArray);
      console.log("updatedSelectedMarkers in draw-map component",
                  selectedMarkers, markersAsArray.length);
      this.sendAction('updatedSelectedMarkers', markersAsArray);
    },

    updatedStacks: function(stacks) {
      let stacksText = stacks.toString();
      // stacks.log();
      // console.log("updatedStacks in draw-map component");
      // no effect :
      this.sendAction('updatedStacks', stacksText);
    },

    mapsToViewDelete : function(mapName)
    {
      console.log("controller/draw-map", "mapsToViewDelete", mapName);
      this.sendAction('mapsToViewDelete', mapName);
    },

      enableAxis2D: function(enabled) {
        console.log("enableAxis2D in components/draw-map", enabled);
        this.set('axis2DEnabled', enabled);
    },

    axisWidthResize : function(apID, width, dx) {
      console.log("axisWidthResize in components/draw-map", apID, width, dx);
      let axisWidthResize = this.get('axisWidthResize');
      if (axisWidthResize) axisWidthResize(apID, width, dx);
    },
    axisWidthResizeEnded : function() {
      console.log("axisWidthResizeEnded in components/draw-map");
      let axisWidthResizeEnded = this.get('axisWidthResizeEnded');
      if (axisWidthResizeEnded) axisWidthResizeEnded();
    },

    resizeView : function()
    {
      console.log("resizeView()");
      // resize();
    }

  },

  /** object attributes */
  oa : {},

  dataObserver : Ember.on('init',
   Ember.observer('dataReceived.length', function(sender, key/*, value, rev*/) {
    let me = this;
    // avoid recursion caused by dataReceived.popObject() below
    console.log("dataObserver", (this === sender), this, /*sender,*/ key /*, value, rev*/);
    let dataReceived = this.get('dataReceived'), newData;
    if (dataReceived)
    Ember.run.later(function () {
      let trace_data;	// undefined
      if ((newData = dataReceived.get('content')))
        for (let ind=0; ind<newData.length; ind++)
    {
      let content = newData;
      console.log("content", content.length, content);
      if (content && content.length)
          {
        console.log( newData.length);
        if (newData[0]) console.log(newData[0].length);

        for (let ic=0; ic < content.length; ic++)
        {
          console.log(ic, content[ic]);
          Ember.run.later(function () { dataReceived.popObject(); });

          {
            let mtv = content[ic],
            m, im, newChr;
            let oa = me.get('oa');
              if ((oa.aps === undefined) || trace_promise)
                console.log("mtv", mtv.length, mtv, "aps", oa.aps, oa.aps && oa.aps.length);
            if (oa.aps !== undefined)
            for (im=0; im < mtv.length; im++)
            {
              if (oa.aps[m = mtv[im]])
                console.log("mapsToView[", im, "] === ", m);
              else if (oa.chrPromises && oa.chrPromises[m])
                console.log("promise pending for", m);
              else
              {
                newChr = mtv[im];
                console.log(newChr);
                {
                  let thisStore = me.get('store'), pc=thisStore.findRecord('chromosome', m, { reload: true });
                  pc.then(function (ch){
                    let map, mapId, chrName = ch.get('name'), chr = ch.get('id'), markers, rc;
                    console.log(chrName, chr);
                    if (chrName && chr && (map = ch.get('map')) && (mapId = map.get('id'))
                           && (markers = ch.get('markers')))
                    {
                      console.log("findRecord then", chrName, chr, map.get('name'), mapId, markers.length);
                    }
                    else
                    {
                      let ppc=thisStore.peekRecord('chromosome', m);
                      if (ppc !== undefined)
                      {
                        console.log("after findRecord(chromosome, ", m, "), peekRecord() returned", ppc);
                      }
                      else
                      {
                        console.log
                        (ppc._internalModel.id,
                         ppc.get('map').get('name'),
                         ppc.get('name'));

                        if (trace_data)
                        {
                          let ma = ppc.get('markers');
                          ma.forEach(function (cc) { console.log(cc.get('name'), cc.get('position'), cc.get('aliases'));});
                        }
                        ch = ppc;
                        chr = ch.get('id');
                        console.log("chr = ch.get(id)", chr);
                      }
                    }
                    rc = chrData(ch);
                    /** Only 1 chr in hash, but use same structure as routes/mapview.js */
                    let retHash = {};
                    retHash[chr] = rc;
                    me.draw(retHash, undefined, 'dataReceived');
                  });
                }
              }
            }

            /*
             let ppc = newData[0], ma = newData[1];
             console.log(newData[0]._internalModel, newData[1].record);
             console.log
             (ppc._internalModel.id,
             ppc.get('map').get('name'),
             ppc.get('name'));

             ma.forEach(function (cc) { console.log(cc.get('name'), cc.get('position'), cc.get('aliases'));});
             */

          }

        }
      }

    }
    else
    {
      console.log("no dataReceived", dataReceived, newData);
    }
    }, 1000);

})),


  /** Draw the APs (Axis Pieces) and the paths between them.
   * APs are Axis Pieces; in this first stage they correspond to chromosomes,
   * but the plan is for them to represent other data topics and types.
   * Each Chromosome is a part of a genetic map in this application.
   *
   * @param myData array indexed by myAPs[*]; each value is a hash indexed by
   * <mapName>_<chromosomeName>, whose values are an array of markers {location,
   * map:<mapName>_<chromosomeName>, marker: markerName}
   * mapName is referred to as apName (AP - Axis Piece) for generality.
   *
   * @param myData hash indexed by AP names
   * @param availableMaps if not undefined then it is a promise; when this promise has resolved, chrPromises[*].get('map') is available
   * @param source 'didRender' or 'dataReceived' indicating an added map.
   */
  draw: function(myData, availableMaps, source) {
    let chrPromises, myDataKeys;
    if (source === 'didRender')
    {
      chrPromises = myData;
      myData = {};
    }
    myDataKeys = d3.keys(myData);
    console.log("draw()", myData, myDataKeys.length, source);

    // Draw functionality goes here.
    let me = this;

    let oa = this.get('oa');

    /* The draw() from didRender() has the model promise array in myData;
     * not the draw() from dataObserver().
     */
    if (source === 'didRender')
      oa.chrPromises = chrPromises; // used in dataObserver()

    /** Each stack contains 1 or more Axis Pieces (APs).
     * stacks are numbered from 0 at the left.
     * stack[i] is an array of Stack, which contains an array of Stacked,
     * which contains apID & portion.
     */
    let stacks = oa.stacks || (oa.stacks = []);
    /** Give each Stack a unique id so that its <g> can be selected. */
    if (oa.nextStackID === undefined) { oa.nextStackID = 0; }
    /** Reference to all (Stacked) APs by apName.
     */
    let aps = oa.aps || (oa.aps = {});

    let highlightMarker = myData.highlightMarker;
    if (highlightMarker)
    {
      console.log("highlightMarker", highlightMarker);
      delete myData.highlightMarker;
    }


    console.log("oa.apIDs", oa.apIDs, source);
    /** apIDs are <apName>_<chromosomeName> */
    if (source == 'dataReceived')
      oa.apIDs = oa.apIDs.concat(myDataKeys);
    else if ((myDataKeys.length > 0) || (oa.apIDs === undefined))
      oa.apIDs = myDataKeys;
    console.log("oa.apIDs", oa.apIDs);
    /** mapName (apName) of each chromosome, indexed by chr name. */
    let cmName = oa.cmName || (oa.cmName = {});
    /** AP id of each chromosome, indexed by AP name. */
    let mapChr2AP = oa.mapChr2AP || (oa.mapChr2AP = {});

    /** Plan for layout of stacked axes.

     graph : {chromosome{linkageGroup{}+}*}

     graph : >=0  chromosome-s layed out horizontally

     chromosome : >=1 linkageGroup-s layed out vertically:
     catenated, use all the space, split space equally by default,
     can adjust space assigned to each linkageGroup (thumb drag) 
     */

    const dragTransitionTime = 1000;  // milliseconds

    /// width in pixels of the axisHeaderText, which is
    /// 30 chars when the AP (chromosome) name contains the 24 hex char mongodb numeric id,
    /// e.g. 58a29c715a9b3a3d3242fe70_MyChr
    let axisHeaderTextLen = 204; // 203.5, rounded up to a multiple of 2;
    let divHolder=Ember.$('div#holder'),
    holderWidth = divHolder.width();
    //margins, width and height (defined but not be used)
    let margins = [20+14+1, 0, 0, 0], // 10, 10, 10],	// margins : top right bottom left

    marginIndex = {top:0, right:1, bottom:2, left:3},	// indices into margins[]; standard CSS sequence.
    /** use width of div#holder, not document.documentElement.clientWidth because of margins L & R. */
    viewPort = {w: holderWidth, h:document.documentElement.clientHeight},


    /// small offset from axis end so it can be visually distinguished.
    dropTargetYMargin = 10,
    dropTargetXMargin = 10,

    /// Width and Height.  viewport dimensions - margins.
    w = viewPort.w  - margins[marginIndex.right] - margins[marginIndex.left],
    h = viewPort.h - margins[marginIndex.top] - margins[marginIndex.bottom],
    /// approx height of map / chromosome selection buttons above graph
    apSelectionHeight = 140,
    /// approx height of text name of map+chromosome displayed above axis.
    apNameHeight = 14,
    /// approx height of text block below graph which says 'n selected markers'
    selectedMarkersTextHeight = 14,
    /// dimensions of the graph border
    graphDim = {w: w*0.9, h: h - 2 * dropTargetYMargin - apSelectionHeight - apNameHeight - selectedMarkersTextHeight},
    /// yRange is the axis length
    yRange = graphDim.h - 40,
    /** X Distance user is required to drag axis before it drops out of Stack.
     * Based on stacks.length, use apIDs.length until the stacks are formed.
     * See also DropTarget.size.w */
    xDropOutDistance = viewPort.w/(oa.apIDs.length*6),
    /// left and right limits of dragging the axes / chromosomes / linkage-groups.
    dragLimit = {min:-50, max:graphDim.w+70};
    console.log("viewPort=", viewPort, ", w=", w, ", h=", h, ", graphDim=", graphDim, ", yRange=", yRange);
    /// pixels.  can calculate this from AP name * font width
    let
      /// x range of the axis centres. left space at left and right for
      /// axisHeaderTextLen which is centred on the axis.
      /// index: 0:left, 1:right
      axisXRange = [0 + axisHeaderTextLen/2, graphDim.w - axisHeaderTextLen/2];
    let
      /** number of ticks in y axis when AP is not stacked.  reduce this
       * proportionately when AP is stacked. */
      axisTicks = 10,
    /** font-size of y axis ticks */
    axisFontSize = 12;
    /** default colour for paths; copied from app.css (.foreground path {
     * stroke: #808;}) so it can be returned from d3 stroke function.  Also
     * used currently to recognise markers which are in colouredMarkers via
     * path_colour_scale(), which is a useful interim measure until scales are
     * set up for stroke-width of colouredMarkers, or better a class.
     */
    let pathColourDefault = "#808";

    function xDropOutDistance_update () {
      xDropOutDistance = viewPort.w/(oa.stacks.length*6);
    }

    /** Draw paths between markers on APs even if one end of the path is outside the svg.
     * This was the behaviour of an earlier version of this Marker Map Viewer, and it
     * seems useful, especially with a transition, to show the progressive exclusion of
     * paths during zoom.n
     */
    let allowPathsOutsideZoom = false;

    /** When working with aliases: only show unique connections between markers of adjacent APs.
     * Markers are unique within APs, so this is always the case when there are no aliases.
     * Counting the connections (paths) between markers based on aliases + direct connections,
     * if there is only 1 connection between a pair of markers, i.e. the mapping between the APs is 1:1,
     * then show the connection.
     *
     * Any truthy value of unique_1_1_mapping enables the above; special cases :
     * unique_1_1_mapping === 2 enables a basic form of uniqueness which is possibly not of interest
     * unique_1_1_mapping === 3 enables collateStacksA (asymmetric aliases).
     */
    let unique_1_1_mapping = 3;
    /** Include direct connections in U_alias, (affects collateStacks1():pu). */
    let directWithAliases = false;
    // let collateStacks = unique_1_1_mapping === 3 ? collateStacksA : collateStacks1;
    /** look at aliases in adjacent APs both left and right (for unique_1_1_mapping = 3) */
    let adjacent_both_dir = true;
    /** A simple mechanism for selecting a small percentage of the
     * physical maps, which are inconveniently large for debugging.
     * This will be replaced by the ability to request subsections of
     * chromosomes in API requests.
     */
    const filter_location = false;
    /** true means the <path> datum is the text of the SVG line, otherwise it is
     * the "mmaa" data and the "d" attr is the text of the SVG line.
     * @see markerNameOfPath().
     */
    let pathDataIsLine;
    /** true means the path datum is not used - its corresponding data is held in its parent g
     */
    const pathDataInG = true;

    /** Apply colours to the paths according to their marker name (datum); repeating ordinal scale.
     * meaning of values :
     *  set path_colour_domain to
     *   1 : markers
     *   2 : d3.keys(ag)
     *  colour according to input from colouredMarkers; just the listed markerNames is coloured :
     *  each line of markerNames is         domain is
     *   3: markerName                      markerName-s
     *   4: scaffoldName\tmarkerName        scaffoldName-s
     *      scaffoldName can be generalised as class name.
     */
    let use_path_colour_scale = 4;
    let path_colour_scale_domain_set = false;

    /** queue of data received from 'Add Map' requests, accessed with push() and pop() */
    /*
    let dataReceived = this.get('dataReceived');
    console.log("draw() : dataReceived", dataReceived);
     */

    /** export scaffolds and scaffoldMarkers for use in selected-markers.hbs */
    let showScaffoldMarkers = this.get('showScaffoldMarkers');
    console.log("showScaffoldMarkers", showScaffoldMarkers);

    let showAsymmetricAliases = this.get('showAsymmetricAliases');
    console.log("showAsymmetricAliases", showAsymmetricAliases);

    /** Enable display of extra info in the path hover (@see hoverExtraText).
     * Currently a debugging / devel feature, will probably re-purpose to display metadata.
     */
    let showHoverExtraText = true;

    /** Used for d3 attributes whose value is the datum. */
    function I(d) { /* console.log(this, d); */ return d; };

    let svgContainer;

    let
      /** y[apID] is the scale for AP apID.
       * y[apID] has range [0, yRange], i.e. as if the AP is not stacked.
       * g.AP has a transform to position the AP within its stack, so this scale is used
       * for objects within g.AP, and notably its child g.axis, such as the brush.
       * For objects in g.foreground, ys is the appropriate scale to use.
       */
      y = oa.y || (oa.y = {}),
    /** ys[apID] is is the same as y[apID], with added translation and scale
     * for the AP's current stacking (AP.position, AP.yOffset(), AP.portion).
     * See also comments for y re. the difference in uses of y and ys.
     */
    ys = oa.ys || (oa.ys = {}),
    /** scaled x value of each AP, indexed by apIDs */
    o = oa.o || (oa.o = {}),
    /** Count markers in APs, to set stronger paths than normal when working
     * with small data sets during devel.  */
    markerTotal = 0,
    /** z[APid] is a hash for AP APid mapping marker name to location.
     * i.e. z[d.ap][d.marker] is the location of d.marker in d.ap.
     */
    z = oa.z || (oa.z = myData);
    /** All marker names.
     * Initially a Set (to determine unique names), then converted to an array.
     */
    if (oa.d3MarkerSet === undefined)
      oa.d3MarkerSet = new Set();

      if (source === 'didRender')
        d3.keys(chrPromises).forEach(function (ap) {
        /** ap is chr name */
        let c = chrPromises[ap];
        afterChrPromise(c, availableMaps);
        });
      else
        d3.keys(myData).forEach(function (ap) {
        /** ap is chr name */
      receiveChr(ap, myData[ap], source);
      });
    /** When data is received for a chromosome, draw it.
     * @param p promise delivers data of a chromosome
     * @param availableMaps is used to indicate that chr.map has been set.
     * undefined means don't wait - already set; it is set by the resolution of
     * the /geneticmap request, so waiting is only required for the initial display.
     */
    function afterChrPromise(p, availableMaps)
    {
      // console.log("afterChrPromise setup");
      // moved here from routes/mapview model(), placing data for chr in rc instead of retHash[chr]

      let waitFor = [p];
      if (availableMaps)
        waitFor.push(availableMaps);
      Ember.RSVP.all(waitFor).then(function(results) {
        let
          c = results[0],
        rc = {mapName : c.get('map').get('name'), chrName : c.get('name')};
        console.log("afterChrPromise", rc);
        let m = c.get('markers');
        m.forEach(function(marker) {
          let markerName = marker.get('name');
          let markerPosition = marker.get('position');
          let markerAliases = marker.get('aliases');
          rc[markerName] = {location: markerPosition, aliases: markerAliases};
        });
        receiveChr(c.get('id'), rc, 'dataReceived');
        // using named function redraw() instead of anonymous function, so that debounce is effective.
        Ember.run.debounce(redraw, 800);
      })
      .catch(function(reason){
        console.log("afterChrPromise", reason);
      });
    }
    function redraw()
    {
      if (trace_promise > 1)
      {
      console.log("redraw, afterChrPromise then after receiveChr", oa.apIDs, oa.aps);
      oa.stacks.log();
      }
      me.draw({}, undefined, 'dataReceived');
    }
    function receiveChr(ap, c, source) {
      let z = oa.z, cmName = oa.cmName;
      if ((z[ap] === undefined) || (cmName[ap] === undefined))
      {
        z[ap] = c;
      cmName[ap] = {mapName : c.mapName, chrName : c.chrName};
        let mapChrName = makeMapChrName(c.mapName, c.chrName);
      mapChr2AP[mapChrName] = ap;
        if (source == 'dataReceived')
        {
          if (apIDFind(ap) < 0)
            oa.apIDs.push(ap);
        }
      delete c.mapName;
      delete c.chrName;
      console.log("receiveChr", ap, cmName[ap]);
      d3.keys(c).forEach(function(marker) {
        let m = z[ap][marker];
        // alternate filter, suited to physical maps : m.location > 2000000
        if ((markerTotal++ & 0x3) && filter_location)
          delete z[ap][marker];
        else
        {
          oa.d3MarkerSet.add(marker);
          // markerTotal++;

          /** This implementation of aliases was used initially.
           * The marker is simply duplicated (same location, same AP) for each alias.
           * This works, but loses the distinction between direct connections (same marker / gene)
           * and indirect (via aliases).
           */
          if (! unique_1_1_mapping)
          {
            let markerValue = z[ap][marker];
            if (markerValue && markerValue.aliases)
              for (let a of markerValue.aliases)
            {
                z[ap][a] = {location: markerValue.location};
              }
          }
        }

      });
      }
    }
    /** Check if ap exists in oa.apIDs[].
     * @return index of ap in oa.apIDs[], -1 if not found
     */
    function apIDFind(ap) {
      let k;
      for (k=oa.apIDs.length-1; (k>=0) && (oa.apIDs[k] != ap); k--) { }
      return k;
    }
    /** Find apName in oa.apIDs, and remove it. */
    function deleteAPfromapIDs(apName)
    {
      let k = apIDFind(apName);
      if (k === -1)
        console.log("deleteAPfromapIDs", "not found:", apName);
      else
      {
        console.log("deleteAPfromapIDs", apName, k, oa.apIDs);
        let a = oa.apIDs.splice(k, 1);
        console.log(oa.apIDs, "deleted:", a);
      }
    }

    //creates a new Array instance from an array-like or iterable object.
    let d3Markers = Array.from(oa.d3MarkerSet);
    /** Indexed by markerName, value is a Set of APs in which the marker is present.
     * Currently markerName-s are unique, present in just one AP (Chromosome),
     * but it seems likely that ambiguity will arise, e.g. 2 assemblies of the same Chromosome.
     * Terminology :
     *   genetic map contains chromosomes with markers;
     *   physical map (pseudo-molecule) contains genes
     */
    let markerAPs = oa.markerAPs || (oa.markerAPs = {});
    let
      /** Draw a horizontal notch at the marker location on the axis,
       * when the marker is not in a AP of an adjacent Stack.
       * Makes the marker location visible, because otherwise there is no path to indicate it.
       */
      showAll = true,
    /** Show brushed markers, i.e. pass them to updatedSelectedMarkers().
     * The purpse is to save processing time, so this condition does not disable
     * the calls to updatedSelectedMarkers which are clearing the markers (but
     * could do - factor the me.send('updatedSelectedMarkers', selectedMarkers);.
     */
    showSelectedMarkers = true;

    /** Alias groups : ag[agName] : [ marker ]    marker references AP and array of aliases */
    let ag = oa.ag || (oa.ag = {});


    /** Map from marker names to AP names.
     * Compiled by collateMarkerMap() from z[], which is compiled from d3Data.
     */
    let am;
    /** Map from marker names to AP names, via aliases of the marker.
     * Compiled by collateMarkerMap() from z[], which is compiled from d3Data.
     */
    let aa;

    // results of collateData()
    let
      /** ap / alias : marker    aam[ap][marker alias] : [marker] */
      aam = oa.aam || (oa.aam = {}),
    /** ap/marker : alias groups       amag[ap][marker] : ag
     * absorbed into z[ap][marker].agName
     amag = {},  */
    // results of collateMagm() - not used
    /** marker alias groups APs;  maga[markerName] is [stackIndex, a0, a1] */
    maga = {};

    /** class names assigned by colouredMarkers to alias groups, indexed by alias group name.
     * result of collateMarkerClasses().
     */
    let agClasses = {};

    // results of collateStacks1()
    let
      /** marker : AP - AP    maN[marker] : [[marker, marker]] */
      maN = oa.maN || (oa.maN = {}),
    /** Not used yet; for pathAg().
     *  store : alias group : AP/marker - AP/marker   agam[ag] : [marker, marker]  markers have refn to parent AP
     * i.e. [ag] -> [marker0, a0, a1, za0[marker0], za1[marker0]] */
    agam = {},
    /** path data in unique mode. [marker0, marker1, a0, a1] */
    pu;
    /** Paths - Unique, from Tree. */
    let put;

    /** results of collateAdjacentAPs() */
    let adjAPs = oa.adjAPs || (oa.adjAPs = {});
    /** results of collateStacksA() */
    let aliased = {};
    let aliasedDone = {};

    let
      line = d3.line(),
      axis = d3.axisLeft(),
      foreground,
      // brushActives = [],
      /** Extent of current brush (applied to y axis of a AP). */
      brushExtents = [];
    /** guard against repeated drag event before previous dragged() has returned. */
    let dragging = 0;
    /** trace scale of each AP just once after this is cleared.  */
    let tracedApScale = {};


    /**
     * @return true if a is in the closed interval range[]
     * @param a value
     * @param range array of 2 values - limits of range.
     */
    function inRange(a, range)
    {
      return range[0] <= a && a <= range[1];
    }

    /** Used for group element, class "AP"; required because id may start with
     * numeric mongodb id (of geneticmap) and element id cannot start with
     * numeric.
     * Also used for g.stack, which is given a numeric id (@see nextStackID).
     * Not used for axis element ids; they have an "m" prefix.
     */
    function eltId(name)
    {
      return "id" + name;
    }
    /** id of axis g element, based on apName, with an "a" prefix. */
    function axisEltId(name)
    {
      return "a" + name;
    }
    /** id of highlightMarker div element, based on marker name, with an "h" prefix. */
    function highlightId(name)
    {
      return "h" + name;
    }
    /** recognise any punctuation in m which is not allowed for a selector matching an element class name,
     * and replace with _
     * Specifically :
     *   replace . with _,
     *   prefix leading digit with _
     *
     * HTML5 class names allow these forms, so eltClassName() is only required
     * where the class name will be the target of a selector.
     * CSS selectors can use \ escaping e.g. to prefix '.', and that works for
     * d3.select() and Ember.$() selectors (using \\);  for now at least
     * the simpler solution of replacing '.' with '_' is used.
     *
     * A class with a numeric prefix is accepted by HTML5, but not for selectors (CSS, d3 or $),
     * so eltClassName() is required at least for that.
     */
    function eltClassName(m)
    {
      m = m.replace(".", "_")
        .replace(/^([\d])/, "_$1");
      return m;
    }

    /** Check if the given value is a number, i.e. !== undefined and ! isNaN().
     * @param l value to check
     * @param return the given parameter l, so that the call can be in a function chain.
     */
    function checkIsNumber(l)
    {
      if ((l === undefined) || Number.isNaN(l))
      {
        console.log("checkIsNumber", l);
        debugger;
      }
      return l;
    }

    function mapChrName2AP(mapChrName)
    {
      let apName = mapChr2AP[mapChrName];
      return apName;
    }
    /** @return chromosome name of AP id. */
    function apName2Chr(apName)
    {
      let c = oa.cmName[apName];
      return c.chrName;
    }
    function makeMapChrName(mapName, chrName)
    {
      return mapName + ':' + chrName;
    }
    function makeIntervalName(chrName, interval)
    {
      return chrName + "_" + interval[0] + "_" + interval[1];
    }

    /*------------------------------------------------------------------------*/
    /** Set svgContainer.class .dragTransition to make drop zones insensitive during drag transition.
     * @return new drag transition
     */
    function dragTransitionNew()
    {
      dragTransition(true);
      let t = d3.transition().duration(dragTransitionTime);
      t.ease(d3.easeCubic);
      return t;
    }
    /** Signal the start or end of a drag transition, i.e. a AP is dragged from
     * one Stack to another - dropIn() or dropOut().
     * During this transition, 
     * @param start signifies start (true) or end (false) of drag transition.
     */
    function dragTransition(start)
    {
      if (start)
        console.log("dragTransition(start)");
      oa.svgContainer.classed("dragTransition", start);
    }
    function dragTransitionEnd(data, index, group)
    {
      console.log("dragTransitionEnd", /*this,*/ data, index, group);
      dragTransition(false);
    }
    /*------------------------------------------------------------------------*/
    /** @return x rounded to 2 decimal places
     */
    function round_2(num)
    {
      /* refn: answer/comments by ustasb, mrkschan, Alex_Nabu at
       * http://stackoverflow.com/users/1575238/
       * stackoverflow.com/questions/11832914/round-to-at-most-2-decimal-places
       * http://stackoverflow.com/questions/588004/is-javascripts-floating-point-math-broken
       */
      return Math.round((num + 0.00001) * 100) / 100;
    }
    /*------------------------------------------------------------------------*/
    /** These trace variables follow this pattern : 0 means no trace;
     * 1 means O(0) - constant size trace, i.e. just the array lengths, not the arrays.
     * further increments will trace the whole arrays, i.e. O(N),
     * and trace cross-products of arrays - O(N^2) e.g. trace the whole array for O(N) events.
     */
    const trace_stack = 1;
    const trace_alias = 1;  // currently no trace at level 1.
    const trace_path = 0;
    const trace_path_colour = 0;
    /** enable trace of adjacency between axes, and stacks. */
    const trace_adj = 1;
    const trace_synteny = 2;
    const trace_gui = 0;
    /*------------------------------------------------------------------------*/

    function Stacked(apName, portion) {
      this.apName = apName;
      this.mapName = oa.cmName[apName].mapName;  // useful in devel trace.
      /** Portion of the Stack height which this AP axis occupies. */
      this.portion = portion;
      // The following are derived attributes.
      /** .position is accumulated from .portion.
       * .position is [start, end], relative to the same space as portion.
       * i.e. .portion = (end - start) / (sum of .portion for all APs in the same Stack).
       * Initially, each AP is in a Stack by itself, .portion === 1, so
       * .position is the whole axis [0, 1].
       */
      this.position = (portion === 1) ? [0, 1] : undefined;
      /** Reference to parent stack.  Set in Stack.prototype.{add,insert}(). */
      this.stack = undefined;
      /* AP objects persist through being dragged in and out of Stacks. */
      oa.aps[apName] = this;
    };
    Stacked.prototype.apName = undefined;
    Stacked.prototype.portion = undefined;
    function positionToString(p)
    {
      return (p === undefined) ? ""
        : "[" + round_2(p[0]) + ", " + round_2(p[1]) + "]";
    }
    /** this function and positionToString() thrash the heap, so perhaps change to return
     * arrays of strings, just concat the arrays, and caller can join the strings. */
    Stacked.prototype.toString = function ()
    {
      let a =
        [ "{apName=", this.apName, ":", this.apName, ", portion=" + round_2(this.portion),
          positionToString(this.position) + this.stack.length, "}" ];
      return a.join("");
    };
    Stacked.prototype.log = function ()
    {
      console.log
      ("{apName=", this.apName, ":", this.mapName, ", portion=", round_2(this.portion),
       positionToString(this.position), this.stack,  "}");
    };
    Stacked.apName_match =
      function (apName)
    { return function (s) { return s.apName === apName; };};
    Stacked.prototype.yOffset = function ()
    {
      let yOffset = yRange * this.position[0];
      if (Number.isNaN(yOffset))
      {
        console.log("Stacked#yOffset", yRange, this.position);
        debugger;
      }
      return yOffset;
    };
    Stacked.prototype.yRange = function ()
    {
      return yRange * this.portion;
    };
    /** Constructor for Stack type.
     * Construct a Stacked containing 1 AP (apName, portion),
     * and push onto this Stack.
     */
    function Stack(stackable) {
      console.log("new Stack", oa, oa.nextStackID);
      this.stackID = oa.nextStackID++;
      /** The AP object (Stacked) has a reference to its parent stack which is the inverse of this reference : 
       * aps{apName}.stack.aps[i] == aps{apName} for some i.
       */
      this.aps = [];
      Stack.prototype.add = Stack_add;
      this.add(stackable);
    };
    /**  Wrapper for new Stack() : implement a basic object re-use.
     *
     * The motive is that as a AP is dragged through a series of stacks, it is
     * removed from its source stack, inserted into a destination stack, then as
     * cursor drag may continue, removed from that stack, and may finally be
     * moved into a new (empty) stack (dropOut()).  The abandoned empty stacks
     * are not deleted until dragended(), to avoid affecting the x positions of
     * the non-dragged stacks.  These could be collected, but it is simple to
     * re-use them if/when the AP is dropped-out.  By this means, there is at
     * most 1 abandoned stack to be deleted at the end of the drag; this is
     * stacks.toDeleteAfterDrag.
     */
    function new_Stack(stackable) {
      let stacks = oa.stacks, s;
      if (stacks.toDeleteAfterDrag !== undefined)
      {
        s = stacks.toDeleteAfterDrag;
        stacks.toDeleteAfterDrag = undefined;
        s.add(stackable);
      }
      else
      {
        s = new Stack(stackable);
        stacks.append(s);
      }
      return s;
    }
    /** undefined, or references to the AP (Stacked) which is currently dropped
     * and the Stack which it is dropped into (dropIn) or out of (dropOut).
     * properties :
     * out : true for dropOut(), false for dropIn()
     * stack: the Stack which apName is dropped into / out of
     * 'apName': apName,
     * dropTime : Date.now() when dropOut() / dropIn() is done
     *
     * static
     */
    Stack.currentDrop = undefined;
    /** undefined, or name of the AP which is currently being dragged. */
    Stack.currentDrag = undefined;
    /** @return true if this.aps[] is empty. */
    Stack.prototype.empty = function ()
    {
      return this.aps.length === 0;
    };
    /** @return array of apIDs of this Stack */
    Stack.prototype.apIDs = function ()
    {
      let a =
        this.aps.map(function(s){return s.apName;});
      return a;
    };
    Stack.prototype.toString = function ()
    {
      let a =
        [
          "{aps=[",
          this.aps.map(function(s){return s.toString();}),
          "] length=" + this.aps.length + "}"
        ];
      return a.join("");
    };
    Stack.prototype.log = function ()
    {
      console.log("{stackID=", this.stackID, ", aps=[");
      this.aps.forEach(function(s){s.log();});
      console.log("] length=", this.aps.length, "}");
    };
    Stack.prototype.verify = function ()
    {
      if (this.aps.length == 0)
      {
        this.log();
        /* breakPointEnable = 1;
         breakPoint(); */
      }
    };
    /** Attributes of the stacks object.
     *
     * stacks.toDeleteAfterDrag
     * stack left empty by dropOut(); not deleted until dragended(), to avoid
     * affecting the x positions of the non-dragged stacks.  @see new_Stack()
     *
     * stacks.changed
     * true when an axis and/or stack has been moved drag; this triggers
     * axisStackChanged() to be called to update the drawing.
     * The update is split in 2 because x locations of stacks do not update during the drag (@see dragended() ) :
     * 0x01 : drag has not finished - interim redraw;
     * 0x10 : drag has finished.  The final x locations of stacks have been calculated.
     * (would use 0b instead of 0x but 0b may not be supported on IE)
     * This will evolve into a signal published by the stacks component,
     * listened to by draw components such as syntenyBlocks.
     */
    /** Log all stacks. static. */
    stacks.log = 
      Stack.log = function()
      {
        let stacks = oa.stacks;
        if (trace_stack < 2) return;
        console.log("{stacks=[");
        stacks.forEach(function(s){s.log();});
        console.log("] length=", stacks.length, "}");
      };
    Stack.verify = function()
    {
      oa.stacks.forEach(function(s){s.verify();});
    };
    /** Append the given stack to stacks[]. */
    stacks.append = function(stack)
    {
      oa.stacks.push(stack);
    };
    /** Insert the given stack into stacks[] at index i. */
    stacks.insert = function(stack, i)
    {
      let stacks = oa.stacks;
      stacks = stacks.insertAt(i, stack);
    };
    /** stackID is used as the domain of the X axis. */
    stacks.stackIDs = function()
    {
      let sis = oa.stacks.map(
        function (s) {
          return s.stackID;
        });
      return sis;
    };
    /** Sort the stacks by the x position of their APs. */
    stacks.sortLocation = function()
    {
      oa.stacks.sort(function(a, b) { return a.location() - b.location(); });
    };
    /** Return the x location of this stack.  Used for sorting after drag. */
    Stack.prototype.location = function()
    {
      let l = this.aps[0].location();
      checkIsNumber(l);
      return l;
    };
    /** Find this stack within stacks[] and return the index.
     * @return -1 or index of the parent stack of AP
     */
    Stack.prototype.stackIndex = function ()
    {
      /** Could cache result in s; this function is often used; may not affect speed much. */
      let s = this, i = oa.stacks.indexOf(s);
      return i;
    };
    /** Use the position of this stack within stacks[] to determine g.ap element classes.
     *
     * Use : the classes are used in css selectors to determine text-anchor.
     * If the stack is at the left or right edge of the diagram, then the titles
     * of APs in the stack will be displayed on the outside edge, so that paths
     * between APs (in .foreground) won't obscure the title.
     *
     * @return "leftmost" or "rightmost" or "" (just one class)
     */
    Stack.prototype.sideClasses = function ()
    {
      let i = this.stackIndex(), n = oa.stacks.length;
      let classes = (i == 0) ? "leftmost" : ((i == n-1) ? "rightmost" : "");
      return classes;
    };
    /** Find stack of apID and return the index of that stack within stacks.
     * static
     * @param apID name of AP to find
     * @return -1 or index of found stack
     */
    Stack.apStackIndex = function (apID)
    {
      let ap = oa.aps[apID], s = ap.stack, i = s.stackIndex();
      return i;
    };
    /** Find stack of apID and return the index of that stack within stacks.
     * static
     * @param apID name of AP to find
     * @return undefined or
     *  {stackIndex: number, apIndex: number}.
     */
    Stack.apStackIndex2 = function (apID)
    {
      let ap = oa.aps[apID];
      if (ap === undefined)
        return undefined;
      else
      {
        let s = ap.stack, i = s.stackIndex();
        let j;
        if ((i === -1) || (stacks[i] !== s) || (j=s.aps.indexOf(ap), s.aps[j].apName != apID))
        {
          console.log("stackIndex", apID, i, ap, s, j, s.aps[j]);
          debugger;
        }
        return {stackIndex: i, apIndex: j};
      }
    };

    Stack.prototype.add = function(stackable)
    {
      this.aps.push(stackable);
      stackable.stack = this;
      oa.aps[stackable.apName] = stackable;
    };
    Stack.prototype.addAp = function(apName, portion)
    {
      let sd = new Stacked(apName, portion);
      this.add(sd);
    };
    /** Method of Stack.  @see Stack.prototype.add().
     * Add the given AP to this Stack.
     * @param sd  (stackable) Stacked / AP to add
     */
    function Stack_add (sd)
    {
      this.aps.push(sd);
      sd.stack = this;
    };
    /** Insert stacked into aps[] at i, moving i..aps.length up
     * @param i  same as param start of Array.splice()
     * @see {@link https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Array/splice | MDN Array Splice}
     */
    Stack.prototype.insert = function (stacked, i)
    {
      let len = this.aps.length;
      // this is supported via splice, and may be useful later, but initially it
      // would indicate an error.
      if ((i < 0) || (i > len))
        console.log("insert", stacked, i, len);

      this.aps = this.aps.insertAt(i, stacked);
      /* this did not work (in Chrome) : .splice(i, 0, stacked);
       * That is based on :
       * https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Array/splice
       * Similarly in 2 other instances in this file, .removeAt() is used instead of .splice().
       */

      stacked.stack = this;
    };
    /** Find apName in this.aps[]. */
    Stack.prototype.findIndex = function (apName)
    {
      let mi = this.aps.findIndex(Stacked.apName_match(apName));
      return mi;
    };
    /** Find apName in this.aps[] and remove it.
     * @return the AP, or undefined if not found
     */
    Stack.prototype.remove = function (apName)
    {
      let si = this.findIndex(apName);
      if (si < 0)
      {
        console.log("Stack#remove named AP not in this stack", this, apName);
        return undefined;
      }
      else
      {
        let s = this.aps[si];
        this.aps = this.aps.removeAt(si, 1);
        // .splice(si, 1);
        return s;
      }
    };
    /** Remove the nominated AP (Stacked) from this Stack;
     * if this Stack is now empty, remove it from stacks[].
     * static
     * @param apName  name of AP to remove
     * @return undefined if not found, else -1, or stackID if the parent stack is also removed.
     * -1 indicates that the Stacked was removed OK and its parent was not removed because it has other children.
     */
    Stack.removeStacked = function (apName)
    {
      let result;
      console.log("removeStacked", apName);
      let ap = oa.aps[apName];
      if (ap === undefined)
      {
        console.log("removeStacked", apName, "not in", aps);
        result = undefined; // just for clarity. result is already undefined
      }
      else
      {
        let stack = ap.stack;
        result = stack.removeStacked1(apName);
        if (result === undefined)
          result = -1; // OK
      }
      if (trace_stack)
        console.log("removeStacked", apName, result);
      return result;
    };
    /** Remove the nominated AP (Stacked) from this Stack;
     * if this Stack is now empty, remove it from stacks[].
     *
     * @param apName  name of AP to remove
     * @return this.stackID if this is delete()-d, otherwise undefined
     * @see Stack.removeStacked(), which calls this.
     */
    Stack.prototype.removeStacked1 = function (apName)
    {
      let result;
      let ap = oa.aps[apName],
      removedAp = this.remove(apName);
      if (removedAp === undefined)
        console.log("removeStacked", apName);
      else
        delete oa.aps[apName];
      if (this.empty())
      {
        result = this.stackID;
        if (! this.delete())
        {
          console.log("removeStacked", this, "not found for delete");
        }
        else if (trace_stack)
          Stack.log();
      }
      else
      {
        console.log("removeStacked", this);
        // copied from .dropOut()
        let released = ap.portion;
        ap.portion = 1;
        this.releasePortion(released);
        // result is already undefined
      }
      return result;
    };
    /** Remove this Stack from stacks[].
     * @return false if not found, otherwise it is removed
     */
    Stack.prototype.delete = function ()
    {
      let stacks = oa.stacks;
      let si = stacks.indexOf(this);
      let ok = false;
      if (si < 0)
        console.log("Stack#delete program error: not found", this, stacks);
      else if (this !== stacks[si])
        console.log("Stack#delete program error: found value doesn't match",
                    this, stacks, si, stacks[si]);
      else
      {
        stacks = stacks.removeAt(si, 1);
        // .splice(si, 1);
        ok = true;
      }
      return ok;
    };
    /**
     * Move named AP from one stack to another.
     * `this` is the source stack.
     * If first stack becomes empty - delete it.
     * If 2nd stack (destination) is new - create it (gui ? drag outside of top/bottom drop zones.)
     * @param apName name of AP to move
     * @param toStack undefined, or Stack to move AP to
     * @param insertIndex  index in toStack.aps[] to insert
     *
     * if toStack is undefined, create a new Stack to move the AP into;
     * The position in stacks[] to insert the new Stack is not given via params,
     * instead dragged() assigns x location to new Stack and sorts the stacks in x order.
     *
     * @return undefined if not found, or an array.
     * If `this` is empty after the move, it is deleted, otherwise the result
     * array contains `this`; this is so that the caller can call
     * .calculatePositions().
     */
    Stack.prototype.move = function (apName, toStack, insertIndex)
    {
      let result = undefined;
      let s = this.remove(apName);
      // if apName is not in this.aps[], do nothing
      let ok = s !== undefined;
      if (ok)
      {
        if (toStack === undefined)
        {
          toStack = new_Stack(s);
          /* Need to call .calculatePositions() for this and toStack;
           * That responsibility is left with the caller, except that
           * caller doesn't have toStack, so .move() looks after it.
           * No : ap.position and .portion are updated after .move()
           * so caller has to call .calculatePositions().
           toStack.calculatePositions();
           */
        }
        else
          toStack.insert(s, insertIndex);
        result = [];
        if (this.empty())
        {
          // this.delete();
          /* Defer delete because when it is deleted :
           * If source stack has only 1 AP, then dropOut() deletes the stack
           * and stacks to its right shift left in the array to fill the gap;
           * That causes : destination stack moves to x of source stack when
           * dragging to the right, iff the source stack has only 1 AP.
           * That behaviour should occur after dragended, not during.
           */
          stacks.toDeleteAfterDrag = this;
        }
        else
          result.push(this);
        if (trace_updatedStacks)
          me.send('updatedStacks', oa.stacks);
      }
      return result;
    };
    /** Shift named AP to a different position within this Stack.
     * Portions will be unchanged, positions will be re-calculated.
     * Find apName in this.aps[] and move it.

     * @param apName name of AP to move
     * @param insertIndex  index in toStack.aps[] to insert
     * @return the AP, or undefined if not found
     */
    Stack.prototype.shift = function (apName, insertIndex)
    {
      let si = this.findIndex(apName);
      if (si < 0)
      {
        console.log("Stack#remove named AP not in this stack", this, apName);
        return undefined;
      }
      else
      {
        let s = this.aps[si];
        console.log("shift(), before removeAt()", this, apName, insertIndex, this.aps.length, s);
        this.log();
        this.aps = this.aps.removeAt(si, 1);
        let len = this.aps.length;
        this.log();
        if (insertIndex >= len)
          console.log("shift()", this, apName, insertIndex, " >= ", len, s);
        let insertIndexPos = (insertIndex < 0) ? len + insertIndex : insertIndex;
        // splice() supports insertIndex<0; if we support that, this condition need
        if (si < insertIndexPos)
          insertIndexPos--;
        this.aps = this.aps.insertAt(insertIndexPos, s);
        console.log("shift(), after insertAt()", insertIndexPos, this.aps.length);
        this.log();
        return s;
      }
    };
    /** @return true if this Stack contains apName
     */
    Stack.prototype.contains = function (apName)
    {
      return this === oa.aps[apName].stack;
    };
    /** Insert the named AP into this.aps[] at insertIndex (before if top, after
     * if ! top).
     * Preserve the sum of this.aps[*].portion (which is designed to be 1).
     * Give the new AP a portion of 1/n, where n == this.aps.length after insertion.
     *
     * share yRange among APs in stack
     * (retain ratio among existing APs in stack)
     *
     * @param apName name of AP to move
     * @param insertIndex position in stack to insert at.
     * @param true for the DropTarget at the top of the axis, false for bottom.
     * @param transition  make changes within this transition
     */
    Stack.prototype.dropIn = function (apName, insertIndex, top, transition)
    {
      let aps = oa.aps;
      console.log("dropIn", this, apName, insertIndex, top);
      let fromStack = aps[apName].stack;
      /* It is valid to drop a AP into the stack it is in, e.g. to re-order the APs.
       * No change to portion, recalc position.
       */
      if (this === fromStack)
      {
        console.log("Stack dropIn() AP ", apName, " is already in this stack");
        this.shift(apName, insertIndex);
        return;
      }
      /** Any AP in the stack should have the same x position; use the first
       * since it must have at least 1. */
      let anApName = this.aps[0].apName,
      /** Store both the cursor x and the stack x; the latter is used, and seems
       * to give the right feel. */
      dropX = {event: d3.event.x, stack: oa.o[anApName]};
      Stack.currentDrop = {out : false, stack: this, 'apName': apName, dropTime : Date.now(), x : dropX};
      if (! top)
        insertIndex++;
      let okStacks =
        fromStack.move(apName, this, insertIndex);
      // okStacks === undefined means apName not found in fromStack
      if (okStacks)
      {
        // if fromStack is now empty, it will be deleted, and okStacks will be empty.
        // if fromStack is not deleted, call fromStack.calculatePositions()
        let ap = aps[apName],
        released = ap.portion;
        console.log("dropIn", released, okStacks);
        okStacks.forEach(function(s) { 
          s.releasePortion(released);
          s.calculatePositions();
          s.redraw(transition); });

        // For all APs in this (the destination stack), adjust portions, then calculatePositions().
        /** the inserted AP */
        let inserted = this.aps[insertIndex];
        inserted.stack = this;
        // apart from the inserted AP,
        // reduce this.aps[*].portion by factor (n-1)/n
        let n = this.aps.length,
        factor = (n-1)/n;
        inserted.portion = 1/n;
        this.aps.forEach(
          function (a, index) { if (index !== insertIndex) a.portion *= factor; });
        this.calculatePositions();
        stacks.changed = 0x11;
      }
    };
    /** Used when a AP is dragged out of a Stack.
     * re-allocate portions among remaining APs in stack
     * (retain ratio among existing APs in stack)
     * This is used from both dropIn() and dropOut(), for the Stack which the
     * AP is dragged out of.
     * @param released  the portion of the AP which is dragged out
     */
    Stack.prototype.releasePortion = function (released)
    {
      let
        factor = 1 / (1-released);
      this.aps.forEach(
        function (a, index) { a.portion *= factor; });
      this.calculatePositions();
    };
    /** Drag the named AP out of this Stack.
     * Create a new Stack containing just the AP.
     *
     * re-allocate portions among remaining APs in stack
     * (retain ratio among existing APs in stack)
     *
     * .dropIn() and .dropOut() both affect 2 stacks : the AP is dragged from
     * one stack (the term 'source' stack is used in comments to refer this) to
     * another (call this the 'destination' stack). .dropOut() may create a new
     * stack for the destination.
     *
     * @param apName name of AP to move
     */
    Stack.prototype.dropOut = function (apName)
    {
      console.log("dropOut", this, apName);
      Stack.currentDrop = {out : true, stack: this, 'apName': apName, dropTime : Date.now()};

      /* passing toStack===undefined to signify moving AP out into a new Stack,
       * and hence insertIndex is also undefined (not used since extracted AP is only AP
       * in newly-created Stack).
       */
      let okStacks =
        this.move(apName, undefined, undefined);
      /* move() will create a new Stack for the AP which was moved out, and
       * add that to Stacks.  dragged() will assign it a location and sort.
       */

      // Guard against the case that `this` became  empty and was deleted.
      // That shouldn't happen because dropOut() would not be called if `this` contains only 1 AP.
      if (okStacks && (okStacks[0] == this))
      {
        // apName goes to full height. other APs in the stack take up the released height proportionately
        let ap = oa.aps[apName],
        released = ap.portion;
        ap.portion = 1;
        this.releasePortion(released);
        let toStack = ap.stack;
        toStack.calculatePositions();
        stacks.changed = 0x11;
      }
    };
    /** Calculate the positions of the APs in this stack
     * Position is a proportion of yRange.
     *
     * Call updateRange() to update ys[apName] for each AP in the stack.
     */
    Stack.prototype.calculatePositions = function ()
    {
      // console.log("calculatePositions", this.stackID, this.aps.length);
      let sumPortion = 0;
      this.aps.forEach(
        function (a, index)
        {
          a.position = [sumPortion,  sumPortion += a.portion];
          updateRange(a);
        });
    };
    /** find / lookup Stack of given AP.
     * This is now replaced by aps[apName]; could be used as a data structure
     * validation check.
     * static
     */
    Stack.apStack = function (apName)
    {
      // could use a cached structure such as apStack[apName].
      // can now use : aps{apName}->stack
      let as = oa.stacks.filter(
        function (s) {
          let i = s.findIndex(apName);
          return i >= 0;
        });
      if (as.length != 1)
        console.log("apStack()", apName, as, as.length);
      return as[0];
    };
    /** find / lookup Stack of given AP.
     * static
     * @return undefined or
     *  {stackIndex: number, apIndex: number}.
     *
     * See also above alternative apStackIndex().
     * This version accumulates an array (because reduce() doesn't stop at 1).
     * It will only accumulate the first match (apIndex) in each stack,
     * but by design there should be just 1 match across all stacks.
     * Only the first result in the array is returned, and a warning is given if
     * there are !== 1 results
     * Probably drop this version - not needed;  could be used as a data structure
     * validation check, e.g. in testing.
     */
    Stack.apStackIndexAll = function (apName)
    {
      /** called by stacks.reduce() */
      function findIndex_apName
      (accumulator, currentValue, currentIndex /*,array*/)
      {
        let i = currentValue.findIndex(apName);
        if (i >= 0)
          accumulator.push({stackIndex: currentIndex, apIndex: i});
        return accumulator;
      };
      let as = oa.stacks.reduce(findIndex_apName, []);
      if (as.length != 1)
      {
        console.log("apStackIndexAll()", apName, as, as.length);
      }
      return as[0];
    };
    /** @return transform : translation, calculated from AP position within stack.
     */
    Stacked.prototype.apTransform = function ()
    {
      if (this.position === undefined || yRange === undefined)
      {
        console.log("apTransform()", this.apName, this, yRange);
        debugger;
      }
      let yOffset = this.yOffset(),
      yOffsetText = Number.isNaN(yOffset) ? "" : "," + this.yOffset();
      let scale = this.portion,
      scaleText = Number.isNaN(scale) ? "" : " scale(" + scale + ")";
      /** Will be undefined when AP is dragged out to form a new Stack, which
       * is not allocated an x position (via xScale()) until dragended().  */
      let xVal = x(this.apName);
      if (xVal === undefined)
        xVal = oa.o[this.apName];
      checkIsNumber(xVal);
      xVal = Math.round(xVal);
      let transform =
        [
          "translate(" + xVal, yOffsetText, ")",
          scaleText
        ].join("");
      console.log("apTransform", this, transform);
      return transform;
    };
    /** Get stack of AP, return transform. */
    Stack.prototype.apTransform = function (apName)
    {
      let a = oa.aps[apName];
      return a.apTransform();
    };
    /** Get stack of AP, return transform. */
    Stack.prototype.apTransformO = function (apName)
    {
      let a = oa.aps[apName];
      return a.apTransformO();
    };
    /** For each AP in this Stack, redraw axis, brush, foreground paths.
     * @param t transition in which to make changes
     */
    Stack.prototype.redraw = function (t)
    {
      const trace_stack_redraw = 0;
      /* Currently redraw() is used just after dropIn,Out(), and hence is
       * particular to the drag transition, but the transition object t and
       * dragTransition() could be factored out of redraw() and passed in as an
       * arg.
       */
      /* tried "end", "start", "end.Dav127".  only "start" works.  refn:
       * https://github.com/d3/d3-transition/blob/master/README.md#transition_on
       */
      t.on("end interrupt", dragTransitionEnd);
      /** to make this work, would have to reparent the APs - what's the benefit
       * let ts = 
       *   t.selectAll("g.stack#" + eltId(this.stackID) + " > .ap");
       */
      console.log("redraw() stackID:", this.stackID);
      let this_Stack = this;  // only used in trace

      this.aps.forEach(
        function (a, index)
        {
          /** Don't use a transition for the AP/axis which is currently being
           * dragged.  Instead the dragged object will closely track the cursor;
           * may later use a slight / short transition to smooth noise in
           * cursor.  */
          let t_ = (Stack.currentDrag == a.apName) ? d3 : t;
          // console.log("redraw", Stack.currentDrag, a.apName, Stack.currentDrag == a.apName);
          let ts = 
            t_.selectAll(".ap#" + eltId(a.apName));
          (trace_stack_redraw > 0) &&
            (((ts._groups.length === 1) && console.log(ts._groups[0], ts._groups[0][0]))
             || ((trace_stack_redraw > 1) && console.log("redraw", this_Stack, a, index, a.apName)));
          // console.log("redraw", a.apName);
          // args passed to fn are data, index, group;  `this` is node (SVGGElement)
          ts.attr("transform", Stack.prototype.apTransformO);
          apRedrawText(a);
        });

      this.redrawAdjacencies();
    };

    function apRedrawText(a)
    {
      let axisTS = svgContainer.selectAll("g.ap#" + eltId(a.apName) + " > text");
      axisTS.attr("transform", yAxisTextScale);
      let axisGS = svgContainer.selectAll("g.axis#" + axisEltId(a.apName) + " > g.tick > text");
      axisGS.attr("transform", yAxisTicksScale);
      let axisBS = svgContainer.selectAll("g.axis#" + axisEltId(a.apName) + " > g.btn > text");
      axisBS.attr("transform", yAxisBtnScale);
    }

    /** For each AP in this Stack, redraw axis title.
     * The title position is affected by stack adjacencies.
     * Dragging a stack can affect the rendering of stacks on either side of its start and end position.
     */
    Stack.prototype.redrawAdjacencies = function ()
    {
      let stackClass = this.sideClasses();

      this.aps.forEach(
        function (a, index)
        {
          /** transition does not (yet) support .classed() */
          let as = svgContainer.selectAll(".ap#" + eltId(a.apName));
          as.classed("leftmost", stackClass == "leftmost");
          as.classed("rightmost", stackClass == "rightmost");
          as.classed("not_top", index > 0);
        });
    };

    /*------------------------------------------------------------------------*/

    /** width of the AP.  either 0 or .extended (current width of extension) */
    Stacked.prototype.extendedWidth = function()
    {
      // console.log("Stacked extendedWidth()", this, this.extended);
      return this.extended || 0;
    };

    /** @return range of widths, [min, max] of the APs in this stack */
    Stack.prototype.extendedWidth = function()
    {
      let range = [undefined, undefined];
      this.aps.forEach(
        function (a, index)
        {
          let w = a.extendedWidth();
          if ((range[0] === undefined) || (range[0] > w))
            range[0] = w;
          if ((range[1] === undefined) || (range[1] < w))
            range[1] = w;
        });
      // console.log("Stack extendedWidth()", this, range);
      return range;
    };

    /*------------------------------------------------------------------------*/

    /** Scale to map axis names to x position of axes.
     * sum of stacks, constant inter-space, use max of .extendedWidth().
     * (combine) 2 scales - map stack key to domain space, then to range.
     * Replaces @see xScale() when axes may be split - .extended
      */
    function xScaleExtend()
    {
      /* .extended is measured in the range space (pixels),
       * so calculate space between axes.
       */
      let count = 0, widthSum = 0;
      stacks.forEach(
        function(s){count++; let widthRange = s.extendedWidth(); widthSum += widthRange[1];}
      );
      let widths = stacks.map(
        function(s){ let widthRange = s.extendedWidth(); return widthRange[1];}
      );

      let rangeWidth = axisXRange[1] - axisXRange[0],
      paddingInner = rangeWidth*0.10, paddingOuter = rangeWidth*0.05;
      let gap = (rangeWidth - paddingOuter*2) - widthSum; // total gap
      if (count > 1)
        gap =  gap / (count - 1);

      let stackDomain = Array.from(oa.stacks.keys()); // was apIDs
      let outputs = [], cursor = axisXRange[0];
      count = 0;
      stacks.forEach(
        function(s){
          count++; let widthRange = s.extendedWidth(); let width = widthRange[1];
          outputs.push(cursor);
          cursor += width + gap;
        }
      );
      console.log("xScaleExtend", widths, count, widthSum, axisXRange, paddingInner, paddingOuter, gap, stackDomain, outputs, cursor);
      return d3.scaleOrdinal().domain(stackDomain).range(outputs);
      // .unknown(axisXRange*0.98) ?
    }

    /*------------------------------------------------------------------------*/

    /** x scale which maps from apIDs[] to equidistant points in axisXRange
     */
    //d3 v4 scalePoint replace the rangePoint
    //let x = d3.scaleOrdinal().domain(apIDs).range([0, w]);
    function xScale() {
      let stackDomain = Array.from(oa.stacks.keys()); // was apIDs
      console.log("xScale()", stackDomain);
      return d3.scalePoint().domain(stackDomain).range(axisXRange);
    }

    Stacked.prototype.location = function() { return checkIsNumber(oa.o[this.apName]); };
    /** Same as .apTransform(), but use o[d] instead of x(d)
     * If this works, then the 2 can be factored.
     * @return transform : translation, calculated from AP position within stack.
     */
    Stacked.prototype.apTransformO = function ()
    {
      if (this.position === undefined || yRange === undefined)
      {
        console.log("apTransformO()", this.apName, this, yRange);
        debugger;
      }
      let yOffset = this.yOffset(),
      yOffsetText = Number.isNaN(yOffset) ? "" : "," + this.yOffset();
      /** x scale doesn't matter because x is 0; use 1 for clarity.
       * no need for scale when this.portion === 1
       */
      let scale = this.portion,
      scaleText = Number.isNaN(scale) || (scale === 1) ? "" : " scale(1," + scale + ")";
      let xVal = checkIsNumber(oa.o[this.apName]);
      xVal = Math.round(xVal);
      let transform =
        [
          " translate(" + xVal, yOffsetText, ")",
          scaleText
        ].join("");
      // console.log("apTransformO", this, transform);
      return transform;
    };

    /*------------------------------------------------------------------------*/


    /** Constructor for Flow type.
     *  Wrap the connection of data to display via calculations (aliases etc).
     * These functions operate on an array of Flow-s :  pathUpdate(), collateStacks().
     *
     * The data points in a genetic map are markers, in a physical map (chromosome) they are genes.
     * Here, the term marker is used to mean markers or genes as appropriate.
     * @param direct	true : match marker names; false : match marker aliases against marker names.
     * @param unique	require aliases to be unique 1:1; i.e. endpoints (markers or genes) with only 1 mapping in the adjacent AP are shown
     */
    function Flow(name, direct, unique, collate) {
      this.name = name;
      this.direct = direct;
      this.unique = unique;
      this.collate = collate;
      this.visible = this.enabled;
    };
    Flow.prototype.enabled = true;
    // Flow.prototype.pathData = undefined;
    let flows;
    if ((flows = oa.flows) === undefined) // aka newRender
    {
      oa.flows =
        flows = 
        {
          // direct path() uses maN, collated by collateStacks1();
          direct: new Flow("direct", true, false, collateStacks1/*undefined*/),
          U_alias: new Flow("U_alias", false, false, collateStacks1),	// unique aliases
          alias: new Flow("alias", false, true, collateStacksA)	// aliases, not filtered for uniqueness.
        };
      // flows.U_alias.visible = flows.U_alias.enabled = false;
      // flows.alias.visible = flows.alias.enabled = false;
      // flows.direct.visible = flows.direct.enabled = false;
      flows.direct.pathData = d3Markers;
      // if both direct and U_alias are enabled, only 1 should call collateStacks1().
      if (flows.U_alias.enabled && flows.direct.enabled && (flows.U_alias.collate == flows.direct.collate))
        flows.direct.collate = undefined;
    }

    function collateStacks()
    {
      d3.keys(oa.flows).forEach(function(flowName) {
        let flow = oa.flows[flowName];
        if (flow.enabled && flow.collate)
          flow.collate();
      });
    }

    /*------------------------------------------------------------------------*/


    let zoomSwitch,resetSwitch;
    let zoomed = false;
    // let reset = false;
    // console.log("zoomSwitch", zoomSwitch);

    let pathMarkers = oa.pathMarkers || (oa.pathMarkers = {}); //For tool tip

    let selectedAps = oa.selectedAps || (oa.selectedAps = []);;
    let selectedMarkers = {};
    let brushedRegions = {};

    //Reset the selected Marker region, everytime an AP gets deleted
    me.send('updatedSelectedMarkers', selectedMarkers);

    collateData();

    /** For all APs, store the x value of its axis, according to the current scale. */
    function collateO() {
      console.log("collateO", oa.apIDs.length, oa.apIDs);
      oa.apIDs.forEach(function(d){
        let o = oa.o;
        if (trace_stack > 1)
          console.log(d, APid2Name(d), o[d], x(d));
        o[d] = x(d);
        checkIsNumber(oa.o[d]);
        if (o[d] === undefined) { debugger; console.log(x(d)); }
      });
    }
    oa.apIDs.forEach(function(d){
      let s = Stack.apStackIndex2(d);
      // if APid d does not exist in stacks[], add a new stack for it.
      if (s === undefined)
      {
        // initial stacking : 1 AP per stack, but later when db contains Linkage
        // Groups, can automatically stack APs.
        let sd = new Stacked(d, 1),
        stack = new Stack(sd);
        sd.z = oa.z[d];  // reference from Stacked AP to z[apID]
        oa.stacks.append(stack);
        stack.calculatePositions();
      }
    });
    function axisWidthResize(apID, width, dx)
    {
      console.log("axisWidthResize", apID, width, dx);
      oa.aps[apID].extended = width;
      axisWidthResizeRight(apID, width, dx);
    };
    function axisWidthResizeEnded()
    {
      console.log("axisWidthResizeEnded");

      updateXScale();
      stacks.changed = 0x10;
      let t = stacksAdjust(true, undefined);
    };
    /**  add width change to the x translation of axes to the right of this one.
      */
    function axisWidthResizeRight(apID, width, dx)
    {
      console.log("axisWidthResizeRight", apID, width, dx);
      /** this is like Stack.apStackIndex().  */
      let ap = oa.aps[apID], from = ap.stack,
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
        stack.aps.forEach(
          function (a, index)
          {
            o[a.apName] += (dx * close);
          }
        );
        // could filter the selection - just those right of the extended axis
        svgContainer.selectAll(".ap").attr("transform", Stack.prototype.apTransformO);
        stack.aps.forEach( function (a, index) { apRedrawText(aps[a.apName]); });
        pathUpdate(undefined);
      }
    };
    this.set('axisWidthResize', function (apID, width, dx) { axisWidthResize(apID, width, dx); });
    this.set('axisWidthResizeEnded', function () { axisWidthResizeEnded(); });
    function updateXScale()
    {
      // xScale() uses stacks.keys().
      oa.xs = xScaleExtend(); // or xScale();
    }
    updateXScale();
    function x(apID)
    {
      let i = Stack.apStackIndex(apID);
      if (oa.xs.domain().length === 2)
      console.log("x()", apID, i, oa.xs(i), oa.xs.domain(), oa.xs.range());
      if (i === -1) { console.log("x()", apID, i); debugger; }
      return oa.xs(i);
    }
    //let dynamic = d3.scaleLinear().domain([0,1000]).range([0,1000]);
    //console.log(axis.scale(y[apIDs))

    if (source == 'dataReceived')
      stacks.changed = 0x10;
    let t = stacksAdjust(true, undefined);
    xDropOutDistance_update();

    /** update ys[a.apName] for the given AP,
     * according the AP's current .portion.
     * @param a AP (i.e. aps[a.apName] == a)
     */
    function updateRange(a)
    {
      let ys = oa.ys;
      // console.log("updateRange", a, a.apName, ys.length, ys[a.apName]);
      // if called before ys is set up, do nothing.
      if (ys && ys[a.apName])
      {
        let myRange = a.yRange();
        console.log("updateRange", a.apName, a.position, a.portion, myRange);
        ys[a.apName].range([0, myRange]);
      }
    }


    var path_colour_scale;
    let markerScaffold = {}, scaffolds = new Set(), scaffoldMarkers = {};
    let intervals = {}, intervalNames = new Set(), intervalTree = {};
    /** scaffoldTicks[apID] is a set of y locations, relative to the y axis of apID, of horizontal tick marks.
     * General purpose; first use is for scaffold edges.
     */
    let scaffoldTicks =  oa.scaffoldTicks || (oa.scaffoldTicks = {});
    /** syntenyBlocks is an array, each element defines a synteny block which
     * can be seen as a parallelogram connecting 2 axes (APs); the range on each
     * AP is defined by 2 gene names.
     * This is a simple form for input via the content-editable; the result from the BE API may be factored to :
  { chr1, chr2,
    [
      [ gene1, gene2, gene3, gene4, optional_extra_data],
      ...
    ]
  }, ...
     *
     * (the genes could instead be markers on a genetic map, but the planned use of
     * synteny block display is physical maps / genes).
     */
    let syntenyBlocks =  oa.syntenyBlocks || (oa.syntenyBlocks = []);
    if (oa.sbSizeThreshold == undefined)  oa.sbSizeThreshold = 20;      
    if (use_path_colour_scale)
    {
      let path_colour_domain;
      switch (use_path_colour_scale)
      {
      case 1 : path_colour_domain = oa.markers; break;
      case 2 : path_colour_domain = d3.keys(oa.ag); break;
      default:
      case 4:
      case 3 : path_colour_domain = ["unused"];
        this.set('colouredMarkersChanged', function(colouredMarkers_) {
          console.log('colouredMarkers changed, length : ', colouredMarkers_.length);
          let val;
          if ((colouredMarkers_.length !== 0) &&
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

            /** depending on use_path_colour_scale === 3, 4 each line of markerNames is 
             * 3: markerName 
             * 4: scaffoldName\tmarkerName
             */
            let markerNames = colouredMarkers_
            // .split('\n');
            // .match(/\S+/g) || [];
              .match(/[^\r\n]+/g);
            path_colour_scale_domain_set = markerNames.length > 0;
            if (input_path_colour_scale === 3)
              path_colour_scale.domain(markerNames);
            else if (input_path_colour_scale === 4)
            {
              for (let i=0; i<markerNames.length; i++)
              {
                let col=markerNames[i].split(/[ \t]+/),
                scaffoldName = col[0], markerName = col[1];
                markerScaffold[markerName] = scaffoldName;
                // for the tooltip, maybe not required.
                if (scaffoldMarkers[scaffoldName] === undefined)
                  scaffoldMarkers[scaffoldName] = [];
                scaffoldMarkers[scaffoldName].push(markerName);
                scaffolds.add(scaffoldName);
              }
              collateMarkerClasses(markerScaffold);
              if (showScaffoldMarkers !== me.get('showScaffoldMarkers'))
              {
                showScaffoldMarkers = me.get('showScaffoldMarkers');
                console.log("showScaffoldMarkers", showScaffoldMarkers);
              }
              if (showScaffoldMarkers)
              {
                me.set('scaffolds', scaffolds);
                me.set('scaffoldMarkers', scaffoldMarkers);
              }
              let domain = Array.from(scaffolds.keys());
              console.log("domain.length", domain.length);
              path_colour_scale.domain(domain);
            }
            else if (input_path_colour_scale === 5)
            {
              for (let i=0; i<markerNames.length; i++)
              {
                let col=markerNames[i].split(/[ \t]+/),
                mapChrName = col[0], interval = [col[1], col[2]];
                let apName = mapChrName2AP(mapChrName);
                if (intervals[apName] === undefined)
                  intervals[apName] = [];
                intervals[apName].push(interval);
                let intervalName = makeIntervalName(mapChrName, [col[1], + col[2]]);
                intervalNames.add(intervalName);
              }
              d3.keys(intervals).forEach(function (apName) {
                //Build tree
                intervalTree[apName] = createIntervalTree(intervals[apName]);
              });

              // scaffolds and intervalNames operate in the same way - could be merged or factored.
              let domain = Array.from(intervalNames.keys());
              console.log("domain.length", domain.length);
              path_colour_scale.domain(domain);
            }
            else if (input_path_colour_scale === 6)
            {
              for (let i=0; i<markerNames.length; i++)
              {
                let col=markerNames[i].split(/[ \t]+/),
                mapChrName = col[0], tickLocation = col[1];
                let apName = mapChrName2AP(mapChrName);
                if (apName === undefined)
                  console.log("AP not found for :", markerNames[i], mapChr2AP);
                else
                {
                  if (scaffoldTicks[apName] === undefined)
                    scaffoldTicks[apName] = new Set();
                  scaffoldTicks[apName].add(tickLocation);
                }
              }
              console.log(scaffoldTicks);
              showTickLocations(scaffoldTicks, undefined);
            }
            else if (input_path_colour_scale === 7)
            {
              for (let i=0; i<markerNames.length; i++)
              {
                let cols=markerNames[i].split(/[ \t]+/);
                let ok = true;
                for (let j=0; j < 2; j++)
                {
                  /** APs of syntenyBlock may not be loaded yet. */
                  let mapChr2AP = cols[j], apName = mapChrName2AP(mapChr2AP);
                  cols[j] = apName;
                  if (apName === undefined)
                    console.log("AP not found for :", markerNames[i], mapChr2AP);
                  for (let k = 0; k < 2; k++)
                  {
                    let m = cols[2 + 2*j + k];
                    if (oa.z[apName][m] === undefined)
                    {
                      console.log(m, "not in", apName, APid2Name(apName));
                      ok = false;
                    }
                  }
                  ok &= apName !== undefined;
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

    oa.apIDs.forEach(function(d) {
      /** Find the max of locations of all markers of AP name d. */
      let yDomainMax = d3.max(Object.keys(oa.z[d]), function(a) { return oa.z[d][a].location; } );
      let a = oa.aps[d], myRange = a.yRange(), ys = oa.ys, y = oa.y;
      ys[d] = d3.scaleLinear()
        .domain([0, yDomainMax])
        .range([0, myRange]); // set scales for each AP
      
      //console.log("OOO " + y[d].domain);
      ys[d].flipped = false;
      // y and ys are the same until the AP is stacked.
      // The brush is on y.
      y[d] = ys[d].copy();
      y[d].brush = d3.brushY()
        .extent([[-8,0],[8,myRange]])
        .on("end", brushended);
    });
    /** when draw( , 'dataReceived'), pathUpdate() is not valid until ys is updated. */
    let ysUpdated = true;

    let svgRoot;
    let newRender = (svgRoot = oa.svgRoot) === undefined;
    if (newRender)
    {
    d3.select("svg").remove();
    d3.select("div.d3-tip").remove();
    }
    let translateTransform = "translate(" + margins[marginIndex.left] + "," + margins[marginIndex.top] + ")";
    if (newRender)
    {
      oa.svgRoot = 
    svgRoot = d3.select('#holder').append('svg')
      .attr("viewBox", "0 0 " + graphDim.w + " " + graphDim.h)
      .attr("preserveAspectRatio", "none"/*"xMinYMin meet"*/)
      .attr('width', "100%" /*graphDim.w*/)
      .attr('height', graphDim.h /*"auto"*/);
      oa.svgContainer =
    svgContainer = svgRoot
      .append("svg:g")
      .attr("transform", translateTransform);
    }
    else
      svgContainer = oa.svgContainer;


    // svgRoot.classed("devel", (markerTotal / oa.apIDs.length) < 20);

    function setCssVariable(name, value)
    {
      oa.svgRoot.style(name, value);
    }

    /** total the # paths collated for the enabled flows.
     * Used to adjust the stroke-width and stroke-opacity.
     */
    function countPaths()
    {
      let svgRoot = oa.svgRoot;
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
    function countPathsWithData()
    {
      let svgRoot = oa.svgRoot;
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

    //User shortcut from the keybroad to manipulate the APs
    d3.select("#holder").on("keydown", function() {
      if ((String.fromCharCode(d3.event.keyCode)) == "D") {
        console.log("Delete AP (not implemented)");
        // deleteAp();
      }
      else if ((String.fromCharCode(d3.event.keyCode)) == "Z") {
        zoomAp();
      }
      else if ((String.fromCharCode(d3.event.keyCode)) == "R") {
        refreshAp();
      }
      else if ((String.fromCharCode(d3.event.keyCode)) == "A") {
        showAll = !showAll;
        console.log("showAll", showAll);
        refreshAp();
      }
      else if ((String.fromCharCode(d3.event.keyCode)) == " ") {
        console.log("space");
      }
    });

    //Add foreground lines.
    /** pathData is the data of .foreground > g > g, not .foreground > g > g > path */
    function pathDataSwitch() {
      let p = unique_1_1_mapping === 3 ? put
        : (unique_1_1_mapping ? pu : d3Markers);
      return p; }
    let pathData = pathDataSwitch();
    d3.keys(flows).forEach(function(flowName) {
      let flow = flows[flowName];
      // if flow.collate then flow.pathData has been set above by collateStacks().
      if (flow.enabled && ! flow.collate)
        flow.pathData = flow.direct ? d3Markers : (flow.unique ? pu : put);
    });
    /** class of path or g, @see pathDataInG. currently just endpoint markers, could be agName.  */
    /** If Flow.direct then use I for pathClass, otherwise pathClassA()  */
    function pathClassA(d)
    { let d0=d[0], d1=d[1], c = d1 && (d1 != d0) ? d0 + "_" + d1: d0;
      return c; }
    /**  If unique_1_1_mapping then path data is mmaa, i.e. [marker0, marker1, a0, a1]
     */
    function markerNameOfData(da)
    {
      let markerName = (da.length === 4)  // i.e. unique_1_1_mapping
        ? da[0]  //  mmaa, i.e. [marker0, marker1, a0, a1]
        : da;
      return markerName;
    }
    /** @see also pu_log()  */
    function data_text(da)
    {
      return unique_1_1_mapping   // ! flow.direct
        ? [da[0], da[1], da[2].mapName, da[3].mapName]
        : da;
    }

    // this condition is equivalent to newRender
    if ((foreground = oa.foreground) === undefined)
    {
      oa.foreground =
    foreground = svgContainer.append("g") // foreground has as elements "paths" that correspond to markers
      .attr("class", "foreground");
    d3.keys(flows).forEach(function(flowName) {
      let flow = flows[flowName];
      flow.g = oa.foreground.append("g")
        .attr("class", flowName);
    });
    }
    
    pathUpdate(undefined);
    stacks.log();

    // Add a group element for each stack.
    // Stacks contain 1 or more APs.
    /** selection of stacks */
    let stackSd = svgContainer.selectAll(".stack")
      .data(stacks),
    stackS = stackSd
      .enter()
      .append("g");
      if (trace_stack)
      {
        console.log("append g.stack", stackS.size(), stackSd.exit().size());
      }
      /*
    let st = newRender ? stackS :
      stackS.transition().duration(dragTransitionTime);
    let stackS_ = st
       */
      stackS
      .attr("class", "stack")
      .attr("id", stackEltId);

    function stackEltId(s)
    { if (s.stackID === undefined) debugger;
      console.log("stackEltId", s.stackID, s.aps[0].mapName, s);
      return eltId(s.stackID); }

    /** For the given Stack, return its apIDs  */
    function stack_apIDs(stack)
    {
      return stack.apIDs();
    }

    if (stackS && trace_stack)
      logSelection(stackS);

    // Add a group element for each AP.
    // Stacks are selection groups in the result of this .selectAll()
    let apG = stackS.selectAll(".ap")
      .data(stack_apIDs)
      .enter().append("g");
    let allG = apG
      .append('g')
      .attr("class", "axis-all")
      .attr("id", eltIdAll);
    function eltIdAll(d) { return "all" + d; }
    function eltIdGpRef(d, i, g)
    {
      console.log("eltIdGpRef", this, d, i, g);
      let p2 = this.parentNode.parentElement;
      return "#a" + p2.__data__;
    }
    function apShowExtend(ap, apName, apG)
    {
      let initialWidth = 50,
      offsets = ap.extended ? [initialWidth] : [];
      if (apG === undefined)
        apG = svgContainer.selectAll("g.ap#id" + apName);
      let ug = apG.selectAll("g.axis-use")
        .data(offsets);	// x translation of right axis
      let ugx = ug
        .exit()
        .transition().duration(500)
        .remove();
      ugx
        .selectAll("use")
        .attr("transform",function(d) {return "translate(0,0)";});
      ugx
        .selectAll("rect")
        .attr("width", 0);
      ugx
        .selectAll(".foreignObject")
        .attr("width", 0);
      let eg = ug
        .enter()
        .append("g")
        .attr("class", "axis-use");
      // merge / update ?

      let eu = eg
      /* extra "xlink:" seems required currently to work, refn :  dsummersl -
       * https://stackoverflow.com/questions/10423933/how-do-i-define-an-svg-doc-under-defs-and-reuse-with-the-use-tag */
        .append("use").attr("xlink:xlink:href", eltIdGpRef);
      eu.transition().duration(1000)
        .attr("transform",function(d) {return "translate(" + d + ",0)";});

      let er = eg
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 0)
        .attr("height", yRange);
      er
        .transition().duration(1000)
        .attr("width", initialWidth);

      // foreignObject is case sensitive - refn https://gist.github.com/mbostock/1424037
      let ef = eg
        .append("g")
        .append("foreignObject")
        .attr("class", "foreignObject")
      /*.attr("x", 0)
       .attr("y", 0) */
        .attr("width", initialWidth /*0*/)
        .attr("height", yRange);
      let eb = ef
        .append("xhtml:body")
        .attr("class", "axis-table");
      ef
        .transition().duration(1000)
        .attr("width", initialWidth);
      if (eb.node() !== null)	  // .style() uses .node()
        eb
        .append("div")
        .attr("id", "axis2D")
        .style("border:1px green solid");

      me.send('enableAxis2D', ap.extended);

    }

    if (trace_stack)
    {
      if (trace_stack > 1)
        oa.stacks.forEach(function(s){console.log(s.apIDs());});
      let g = apG;
      console.log("g.ap", g.enter().size(), g.exit().size(), stacks.length);
    }
    let g = apG;
    let gt = newRender ? g :
      g.transition().duration(dragTransitionTime);
    gt
      .attr("class", "ap")
      .attr("id", eltId)
      .attr("transform", Stack.prototype.apTransformO);
    g
      .call(
        d3.drag()
          .subject(function(d) { return {x: x(d)}; }) //origin replaced by subject
          .filter(noShiftKeyfilter)
          .on("start", dragstarted) //start instead of dragstart in v4. 
          .on("drag", dragged)
          .on("end", dragended));//function(d) { dragend(d); d3.event.sourceEvent.stopPropagation(); }))
    if (g && trace_stack)
      logSelection(g);

    /*------------------------------------------------------------------------*/
    /** the DropTarget which the cursor is in, recorded via mouseover/out events
     * on the DropTarget-s.  While dragging this is used to know the DropTarget
     * into which the cursor is dragged.
     */
    // oa.currentDropTarget /*= undefined*/;

    function DropTarget() {
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
      /** top and bottom edges relative to the AP's transform. bottom depends
       * on the AP's portion
       */
      edge = {
        top : size.h,
        bottom : function (ap) { return ap.yRange() - size.h; }
      };
      /** @return AP which this DropTarget is part of */
      DropTarget.prototype.getAp = function ()
      {
        /** The datum of the DropTarget is the apName */
        let apName = this.datum(),
        ap = oa.aps[apName];
        return ap;
      };
      /// @parameter top  true or false to indicate zone is positioned at top or
      /// bottom of axis
      /// uses g, a selection <g> of all APs
      DropTarget.prototype.add = function (top)
      {
        // Add a target zone for axis stacking drag&drop
        let stackDropTarget = 
          g.append("g")
          .attr("class", "stackDropTarget" + " end " + (top ? "top" : "bottom"));
        let
          dropTargetY = function (datum/*, index, group*/) {
            let apName = datum,
            ap = oa.aps[apName],
            yVal = top ? -dropTargetYMargin : edge.bottom(ap);
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

      /// @parameter left  true or false to indicate zone is positioned at left or
      /// right of axis
      DropTarget.prototype.addMiddle = function (left)
      {
        // Add a target zone for axis stacking drag&drop
        let stackDropTarget = 
          g.append("g")
          .attr("class", "stackDropTarget" + " middle " + (left ? "left" : "right"));
        function dropTargetHeight(datum/*, index, group*/)
        {
          // console.log("dropTargetHeight", datum, index, group);
          let apName = datum,
          ap = oa.aps[apName];
          return ap.yRange() - 2 * size.h;
        }
        stackDropTarget
          .append("rect")
          .attr("x", left ? -1 * (dropTargetXMargin + posn.X) : dropTargetXMargin )
          .attr("y", edge.top)
          .attr("width", posn.X /*- dropTargetXMargin*/)
          .attr("height", dropTargetHeight)
        ;

        stackDropTarget
          .on("mouseover", dropTargetMouseOver)
          .on("mouseout", dropTargetMouseOut);
      };

      function storeDropTarget(apName, classList)
      {
        oa.currentDropTarget = {apName: apName, classList: classList};
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


      g = allG;
    // Add an axis and title
      /** This g is referenced by the <use>. It contains axis path, ticks, title text, brush. */
      let defG =
    g.append("g")
      .attr("class", "axis")
      .each(function(d) { d3.select(this).attr("id",axisEltId(d)).call(axis.scale(y[d])); });  

    function axisTitle(chrID)
    {
      let cn=oa.cmName[chrID];
      // console.log(".axis text", chrID, cn);
      return cn.mapName + " " + cn.chrName;
    }

    let axisTitleS = g.append("text")
      .attr("y", -axisFontSize)
      .style("font-size", axisFontSize)
      .text(axisTitle /*String*/);
    axisTitleS
        .each(configureAPtitleMenu);
    let axisSpacing = (axisXRange[1]-axisXRange[0])/stacks.length;
    let verticalTitle;
    if ((verticalTitle = axisSpacing < 90))
    {
      // first approx : 30 -> 30, 10 -> 90.  could use trig fns instead of linear.
      let angle = (90-axisSpacing);
      if (angle > 90) angle = 90;
      // should apply this to all consistently, not just appended axis.
      axisTitleS
        .style("text-anchor", "start")
        .attr("transform", "rotate(-"+angle+")");
    }
    svgRoot.classed("verticalTitle", verticalTitle);

    /** For <text> within a g.ap, counteract the effect of g.ap scale() which
     * is based on ap.portion.
     *
     * Used for :
     *  g.ap > g.axis > g.tick > text
     *  g.ap > g.axis > g.btn     (see following yAxisBtnScale() )
     *  g.ap > g.axis > text
     * g.axis has the apName in its name (prefixed via axisEltId()) and in its .__data__.
     * The AP / axis title (g.axis > text) has apName in its name, .__data__, and parent's name
     * (i.e. g[i].__data__ === apName)
     *
     * g.tick already has a transform, so place the scale transform on g.tick > text.
     * g.btn contains <rect> and <text>, both requiring this scale.
     *
     */
    function yAxisTextScale(/*d, i, g*/)
    {
      let
      apName = this.__data__,
      ap = oa.aps[apName],
      portion = ap && ap.portion || 1,
      scaleText = "scale(1, " + 1 / portion + ")";
      // console.log("yAxisTextScale", d, i, g, this, apName, ap, portion, scaleText);
      return scaleText;
    }
    function yAxisTicksScale(/*d, i, g*/)
    {
      let parent = this.parentElement,
      gp = parent.parentElement,
      // could update arguments[0] = gp.__data__, then yAxisTextScale() can use d
      scaleText = yAxisTextScale.apply(gp, arguments);
      return scaleText;
    }
    function yAxisBtnScale(/*d, i, g*/)
    {
      return 'translate(10) ' + yAxisTextScale.apply(this, arguments);
    }

    // Add a brush for each axis.
    allG.append("g")
      .attr("class", "brush")
      .each(function(d) { d3.select(this).call(oa.y[d].brush); });

    //Setup the gene / marker highlight, enabled by url param highlightMarker.
    let highlightMarkerS =
      d3.select('#holder').selectAll(".highlightMarker")
      .data([highlightMarker])
      .enter().append("div")
      .attr("class", "highlightMarker")
      .attr("id", highlightId);

    let hmPos = [20, 500];
    highlightMarkerS.html(highlightMarker)
      .style("left", "" + hmPos[0] + "px")             
      .style("top", "" + hmPos[1] + "px");


    //Setup the tool tip.
      let toolTip = d3.selectAll("html > div#toolTip.toolTip").data([1]).enter().append("div")
      .attr("class", "toolTip")
      .attr("id","toolTip")
      .style("opacity", 0);
    //Probably leave the delete function to Ember
    //function deleteAp(){
    //  console.log("Delete");
    //}

    /** remove g#apName
     */
    function removeAP(apName, t)
    {
      let apS = svgContainer.select("g.ap#" + eltId(apName));
      console.log("removeAP", apName, apS.empty(), apS);
      apS.remove();
    }
    /** remove g.stack#id<stackID
     */
    function removeStack(stackID, t)
    {
      let stackS = svgContainer.select("g.stack#" + eltId(stackID));
      console.log("removeStack", stackID, stackS.empty(), stackS);
      stackS.remove();
    }
    /** remove AP, and if it was only child, the parent stack;  pathUpdate
     * @param stackID -1 (result of .removeStacked) or id of stack to remove
     * @param stack refn to stack - if not being removed, redraw it
     */
    function removeAPmaybeStack(apName, stackID, stack)
    {
      let t = svgContainer.transition().duration(750);
      removeAP(apName, t);
      /** number of stacks is changing */
      let changedNum = stackID != -1;
      if (changedNum)
      {
        removeStack(stackID, t);
      }
      else
      {
        console.log("removeAPmaybeStack", apName, stackID, stack);
        if (stack)
          stack.redraw(t);
      }
      stacks.changed = 0x10;
      /* Parts of stacksAdjust() are applicable to the 2 cases above : either a
       * stack is removed, or a stack is non-empty after an AP is removed from
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
    function axisStackChanged(t)
    {
      showTickLocations(scaffoldTicks, t);
      showSynteny(syntenyBlocks, t);
    }


    //d3.selectAll(".foreground > g > g").selectAll("path")
    /* (Don, 2017Mar03) my reading of handleMouse{Over,Out}() is that they are
     * intended only for the paths connecting markers in adjacent APs, not
     * e.g. the path in the y axis. So I have narrowed the selector to exclude
     * the axis path.  More exactly, these are the paths to include and exclude,
     * respectively :
     *   svgContainer > g.foreground > g.flowName > g.<markerName> >  path
     *   svgContainer > g.stack > g.ap > g.axis#<axisEltId(apName)> > path    (axisEltId() prepends "a"))
     * (apName is e.g. 58b504ef5230723e534cd35c_MyChr).
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
     * sLine (svg line text) which identifies the hover text, or mmaa data
     * which enables hover text to be calculated.
     * @param pathSelection	<path> elements
     */
    function setupMouseHover(pathSelection)
    {
      pathSelection
        .on("mouseover",handleMouseOver)
        .on("mouseout",handleMouseOut);
    }

    /**
     * @param d   SVG path data string of path
     * @param this  path element
     */
    function handleMouseOver(d){
      let sLine, pathMarkersHash;
      let pathMarkers = oa.pathMarkers;
      /** d is either sLine (pathDataIsLine===true) or array mmaa. */
      let pathDataIsLine = typeof(d) === "string";
      if (pathDataIsLine)
      {
        pathMarkersHash = pathMarkers[d];
      }
      else
      {
        sLine = this.getAttribute("d");
        pathMarkersHash = pathMarkers[sLine];
        if ((pathMarkersHash === undefined) && ! pathDataIsLine)
        {
          let mmaa = dataOfPath(this),
          [marker0, marker1, a0, a1] = mmaa;
          let z = oa.z;
          pathMarkerStore(sLine, marker0, marker1, z[a0.apName][marker0], z[a1.apName][marker1]);
          pathMarkersHash = pathMarkers[sLine];
        }
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

      // console.log(d, markerNameOfData(d), sLine, pathMarkersHash);
      let listMarkers  = "";
      // stroke attributes of this are changed via css rule for path.hovered
      d3.select(this)
        .classed("hovered", true);
      toolTip.style("height","auto")
        .style("width","auto")
        .style("opacity", 0.9)
        .style("display","inline");  
      Object.keys(pathMarkersHash).map(function(a){
        let hoverExtraText = pathMarkersHash[a];
        if (hoverExtraText === 1) hoverExtraText = "";
        else if (classSetText) hoverExtraText += classSetText;
        listMarkers = listMarkers + a + hoverExtraText + "<br />";
      });
      toolTip.html(listMarkers)     
        .style("left", (d3.event.pageX) + "px")             
        .style("top", (d3.event.pageY - 28) + "px");
    }

    function handleMouseOut(/*d*/){
      // stroke attributes of this revert to default, as hover ends
      d3.select(this)
        .classed("hovered", false);
      toolTip.style("display","none");
    }


    function zoomAp(){
      console.log("Zoom : zoomAp()");
    }
    function refreshAp(){
      console.log("Refresh");
    }

    /*------------------------------------------------------------------------*/
    /** Draw horizontal ticks on the axes, representing scaffold boundaries.
     * @param t transition or undefined
     */
    function showTickLocations(scaffoldTicks, t)
    {
      d3.keys(scaffoldTicks).forEach
      (function(apName)
       {
         let tickLocations = Array.from(scaffoldTicks[apName].keys());
         /** -  if apName matches nothing, then skip this. */
        let aS = d3.select("#" + axisEltId(apName));
        if (!aS.empty())
        {
          let pS = aS.selectAll("path.horizTick")
             .data(tickLocations),
             pSE = pS.enter()
             .append("path")
            .attr("class", "horizTick");
          pSE
            .each(configureHorizTickHover);
         let pSM = pSE.merge(pS);

          /* update attr d in a transition if one was given.  */
          let p1 = (t === undefined) ? pSM
            : pSM.transition(t);
          p1.attr("d", function(tickY) {
           // based on axisMarkerTick(ai, d)
           /** shiftRight moves right end of tick out of axis zone, so it can
            * receive hover events.
            */
           const xOffset = 25, shiftRight=5;
           let ak = apName,
               sLine = lineHoriz(ak, tickY, xOffset, shiftRight);
           return sLine;
         });
        }
       }
      );
    }

    /** Setup hover info text over scaffold horizTick-s.
     * @see based on similar configureAPtitleMenu()
     */
    function  configureHorizTickHover(location)
    {
      console.log("configureHorizTickHover", location, this, this.outerHTML);
      /** typeof location may also be "number" or "object" - array : syntenyBlocks[x] */
      let text = (location == "string") ? location :  "" + location;
      let node_ = this;
      Ember.$(node_)
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


    /*------------------------------------------------------------------------*/
    /** Draw  synteny blocks between adjacent axes.
     *
     * Uses isAdjacent(), which uses adjAPs[], calculated in
     * collateAdjacentAPs(), called via flows.alias : collateStacksA()
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
      let sbS=svgContainer.selectAll("g.synteny")
        .data(["synteny"]), // datum could be used for class, etc
      sbE = sbS.enter()
        .append("g")
        .attr("class", "synteny"),
      sbM = sbE.merge(sbS);
      if (trace_synteny)
        console.log("showSynteny", sbS.size(), sbE.size(), sbM.size(), sbM.node());

      function sbChrAreAdjacent(sb) {
        let a0 = sb[0], a1 = sb[1], adj = isAdjacent(a0, a1);
        return adj;
      }
      function sbSizeFilter(sb) {
        return sb[SB_SIZE] > oa.sbSizeThreshold;
      }
      let adjSynteny = syntenyBlocks.filter(sbChrAreAdjacent)
        .filter(sbSizeFilter);

      function blockLine (s) {
        let sLine = patham2(s[0], s[1], s.slice(2));
        if (trace_synteny > 3)
        console.log("blockLine", s, sLine);
        return sLine;
      }

      function intervalIsInverted(a, d0, d1)
      {
        // could use markerY_(a, d0), if flipping is implemented via scale
        let inverted = oa.z[a][d0].location > oa.z[a][d1].location;
        if (trace_synteny > 3)
          console.log("intervalIsInverted", a, d0, d1, inverted);
        return inverted;
      }
      function syntenyIsInverted(s) {
        let inverted = intervalIsInverted(s[0], s[2], s[3])
          != intervalIsInverted(s[1], s[4], s[5]);
        if (trace_synteny > 3)
          console.log("syntenyIsInverted", s, inverted);
        return inverted;
      }

      function  configureSyntenyBlockHover(sb)
      {
        let j=0, text = APid2Name(sb[j++]) + "\n" + APid2Name(sb[j++]);
        for ( ; j < sb.length; j++) text += "\n" + sb[j];
        console.log("configureSyntenyBlockHover", sb, text);
        return configureHorizTickHover.apply(this, [text]);
      }

        let pS = sbM.selectAll("path.syntenyEdge")
          .data(adjSynteny),
        pSE = pS.enter()
          .append("path")
          .attr("class", "syntenyEdge")
          .classed("inverted", syntenyIsInverted)
          .each(configureSyntenyBlockHover),
      pSX = pS.exit(),
        pSM = pSE.merge(pS)
          .attr("d", blockLine);
      pSX.remove();
      if (trace_synteny > 1)
        console.log("showSynteny", syntenyBlocks.length, oa.sbSizeThreshold, adjSynteny.length, pS.size(), pSE.size(), pSX.size(), pSM.size(), pSM.node());
      if (trace_synteny > 2)
        console.log(pSM._groups[0]);

    } // showSynteny()

    /*------------------------------------------------------------------------*/



    /** Construct a unique name for a group of aliases - sort the aliases and catenate them.
     */
    function aliasesUniqueName(aliases)
    {
      let s = aliases.sort().join("_");
      aliases.name = s;
      return s;
    }
    /** After data is loaded, collate to enable faster lookup in collateStacks() and dragged().
     * for each AP
     *   for each marker
     *     store : ref to parent AP       .ap
     *     store : marker -> array of APs (or set)  markers[marker] : set of APs
     *     store       ag[ag] : [ marker ] marker references AP and array of aliases
     *     {unique name of alias group (sort) : array of : AP / marker / array of aliases}
     *     for each alias
     *       store AP / alias : marker    aam[AP][marker alias] : marker
     *       store AP/marker : alias groups  (or was that alias groups to marker)
     *          z[AP][marker].agName (maybe later array [ag])
     * 
     */
    function collateData()
    {
      d3.keys(oa.z).forEach(function(ap) {
        let za = oa.z[ap];
        // console.log("collateData", ap, za);
        if (maga[ap] === undefined)
          maga[ap] = {};
        let aam = oa.aam;
        if (aam[ap] === undefined)
        {
          aam[ap] = {};
        let aama = aam[ap];
        d3.keys(za).forEach(function(marker) {
          if ((marker != "mapName") && (marker != "chrName"))
          {
          try
          {
            za[marker].ap = z[ap]; // reference from marker to parent AP
            // console.log("collateData", ap, za, za[marker]);
          } catch (exc)
          {
            console.log("collateData", ap, za, za[marker], exc);
            debugger;
          }
          let markerAPs = oa.markerAPs;
          if (markerAPs[marker] === undefined)
            markerAPs[marker] = new Set();
          markerAPs[marker].add(ap);

          let marker_ = za[marker], mas = marker_.aliases;
          marker_.name = marker;
          if (mas && mas.length)
          {
            /** Include marker's own name in the name of the group of its
             * aliases, because if aliases are symmetric, then e.g.
             *  map/chr1 : M1 {m2,m3}
             *  map/chr2 : m2 {M1,m3}, m3 {M1,m2}
             * i.e. there is just one alias group : {M1,m2,m3}
             * The physical data seems to contain symmetric alias groups of 5-20
             * genes ("markers"); so recognising that there is just one alias
             * group can significantly reduce processing and memory.
             */
            let agName = aliasesUniqueName(mas.concat([marker]));
            let ag = oa.ag;
            if (ag[agName] === undefined)
              ag[agName] = [];
            ag[agName].push(marker_);

            for (let markerAlias of mas)
            {
              // done above, could be moved here, if still required :
              // za[a] = {location: marker_.location};

              if (aama[markerAlias] === undefined)
                aama[markerAlias] = [];
              aama[markerAlias].push(marker);
            }

            if (marker_.agName)
              // should be just 1
              console.log("[marker] agName", ap, marker, marker_, agName);
            else
              marker_.agName = agName;
          }
          }
        });
        }
      });
    }

    /** Collate the classes of markers via alias groups.
     * Inputs : z (including .agName), markerScaffold (from colouredMarkers)
     * Outputs : agClasses
     */
    function collateMarkerClasses(markerScaffold)
    {
      d3.keys(oa.z).forEach(
        function(apName)
        {
          let za = oa.z[apName];
          d3.keys(za).forEach(
            function(markerName)
            {
              let  marker_ = za[markerName],
              agName = marker_.agName,
              mas = marker_.aliases;
              if (mas.length > 0)
              {
                // mas.length > 0 implies .agName is defined
                let agc = agClasses[agName];
                if (agc === undefined)
                {
                  agClasses[agName] = new Set();
                  agc = agClasses[agName];
                }
                // marker_.name === markerName;
                for (let i=0; i<mas.length; i++)
                {
                  let mi = mas[i], className = markerScaffold[mi];
                  if (className)
                    agc.add(className);
                }
              }
            });
        });
    }


    /**             is marker m1 in an alias group of a marker m0 in ap0  ?
     * @return   the matching aliased marker m0 if only 1
     */
    function maInMaAG(ap0, ap1, m1)
    {
      /** Return the matching aliased marker if only 1; amC is the count of matches */
      let am, amC=0;
      /** aama inverts the aliases of m1; i.e. for each alias mA of m1, aama[mA] contains m1.
       * so aama[m1] contains the markers which alias to m0
       * If there are only 1 of those, return it.
       * ?(m1 if m0 is in the aliases of a0:m1)
       */
      let aama = oa.aam[ap0.apName],
      ma = aama[m1],
      z0 = oa.z[ap0.apName];
      let ams = [];
      if (ma)
        for (let mai=0; mai<ma.length; mai++)
      {
          let mai_ = ma[mai];
          if (z0[mai_])
          {
            am = mai_;
            amC++;
            if (trace_alias > 1)
              ams.push(am); // for devel trace.
          }
        }
      if (trace_alias > 1)
        console.log("maInMaAG()", ap0.mapName, ap1.mapName, m1, am, amC, ams);
      if (amC > 1)
        am = undefined;
      else if (trace_alias > 1)
      {
        console.log(aama, ma, z0);
      }
      return am;
    }

    /** At time of axis adjacency change, collate data for faster lookup in dragged().
     *
     *   for each pair of adjacent stacks

     *       for each marker in AP
     *         lookup that marker in the other AP directly
     *           store : marker : AP - AP    maN[marker] : [[marker, marker]]
     *         any connection from a0:marker0 to a1 via alias :
     *         lookup that marker in the other AP via inverted aliases
     *           store : alias group : AP/marker - AP/marker   agam[ag] : [marker, marker]  markers have refn to parent AP
     *         unique 1:1 connection between a0:marker0 and a1:marker1 :
     *           for each marker, marker1, in AP1
     *             consider direct and any alias of a0:marker0
     *             is marker1 in marker0 alias group ?
     *             is marker0 in marker1 alias group ?
     *             (compile hash from each marker alias group)
     *             for AP-AP data is list of ags

     * Results are in pu, which is accessed via Flow.pathData
     */
    function collateStacks1()
    {
      oa.maN = maN = {};
      agam = {};
      pu = flows.U_alias.pathData = [];
      let stacks = oa.stacks;

      for (let stackIndex=0; stackIndex<stacks.length-1; stackIndex++) {
        let s0 = stacks[stackIndex], s1 = stacks[stackIndex+1],
        mAPs0 = s0.aps,
        mAPs1 = s1.aps;
        if (mAPs0.length === 0 || mAPs1.length === 0)
        {
          console.log("mAPs0,1.length", mAPs0.length, mAPs1.length);
          // stacks.log();
        }
        // Cross-product of the two adjacent stacks
        for (let a0i=0; a0i < mAPs0.length; a0i++) {
          let a0 = mAPs0[a0i], za0 = a0.z, a0Name = a0.apName;
          for (let a1i=0; a1i < mAPs1.length; a1i++) {
            let a1 = mAPs1[a1i], za1 = a1.z;
            d3.keys(za0).forEach(function(marker0) {
              /** a0, a1 could be derived from za0[marker0].ap, za1[marker0].ap */
              let maa = [marker0, a0, a1, za0[marker0], za1[marker0]];
              let maN = oa.maN;
              if (za1[marker0])
              {
                if (maN[marker0] === undefined)
                  maN[marker0] = [];
                maN[marker0].push(maa);
                if (trace_path > 3)
                  console.log(marker0, maa);
              }
              // not used yet; to be shared to pathAg().
              // any connection from a0:marker0 to a1 via alias :
              let ag = za0[marker0].agName;
              if (false && ag)
              {
                if (agam[ag] === undefined)
                  agam[ag] = [];
                agam[ag].push(maa);
              }

              /* If marker0 is in an alias of a1, 
               * maInMaAG return the marker if just 1
               * 
               */

              let
                aliasedM0,
                aliasedM1 = maInMaAG(a1, a0, marker0),
                isDirect = directWithAliases && oa.z[a1.apName][marker0] !== undefined;
              let differentAlias;
              if (aliasedM1 || showAsymmetricAliases)
              {
                /* alias group of marker0 may not be the same as the alias group
                 * which links aliasedM1 to a0, but hopefully if aliasedM0 is
                 * unique then it is marker0. */
                aliasedM0 = maInMaAG(a0, a1, aliasedM1);
                /** aliasedM1 is the alias of marker0, so expect that the alias
                 * of aliasedM1 is marker0.  But some data seems to have
                 * asymmetric alias groups.  In that case, we classify the alias
                 * as non-unique. */
                differentAlias = aliasedM0 != marker0;
                if (trace_alias > 1 && differentAlias)
                {
                  let aam = oa.aam;
                  console.log("aliasedM1", aliasedM1, "aliasedM0", aliasedM0, marker0, za0[marker0], za1[aliasedM1], aam[a1.apName][marker0], aam[a0.apName][aliasedM1]);
                }

                let d0 = marker0, d1 = aliasedM1;
                if (false)  // debugging support, could be removed.
                {
                  let traceTarget = marker0 == "markerK" && aliasedM1 == "markerK" &&
                    a0.mapName == "MyMap5" && a1.mapName == "MyMap6";
                  if (traceTarget)
                    debugger;
                }

                if (trace_alias > 1)
                  console.log("collateStacks()", d0, d1, a0.mapName, a1.mapName, a0, a1, za0[d0], za1[d1]);

              }
              let
                nConnections = 0 + (aliasedM1 !== undefined) + (isDirect ? 1 : 0);
              if ((nConnections === 1) && (showAsymmetricAliases || (differentAlias !== true))) // unique
              {
                let 
                  /** i.e. isDirect ? marker0 : aliasedM1 */
                  marker1 = aliasedM1 || marker0,
                mmaa = [marker0, marker1, a0, a1];
                pu.push(mmaa);
                // console.log(" pu", pu.length);
              }
            });
          }
        }
      }
      if (pu)
        console.log("collateStacks", " maN", d3.keys(oa.maN).length, ", pu", pu.length);
      if (trace_path > 4)
      {
        for (let markerj in maN) {
          let maNj = maN[markerj];
          console.log("collateStacks1", markerj, maNj.length);
          for (let i = 0; i < maNj.length; i++)
          {
            log_maamm(maNj[i]);
          }
        }
      }
      if (trace_path > 3)
      {
        pu_log(pu);
      }
    }
    function pu_log(pu)
    {
      if (pu)
        for (let pi=0; pi<pu.length; pi++)
      {
          let p = pu[pi];
          // log_mmaa() give more detail than this.
          // console.log(p[0], p[1], p[2].mapName, p[3].mapName);
          log_mmaa(p);
        }
    }
    /** log content of maN[markerName][i] */
    function log_maamm(m)
    {
      let     [marker0, a0, a1, m0, m1] = m,
      z = oa.z;
      console.log(marker0, a0.mapName, a0.apName, a1.mapName, a1.apName, m0.location, m1.location);
    }
    function log_mmaa(mmaa)
    {
      if ((mmaa === undefined) || (typeof mmaa == "string") || (mmaa.length === undefined))
        console.log(mmaa);
      else
      {
        let     [marker0, marker1, a0, a1, direction, agName] = mmaa,
        z = oa.z,
        m0 = z[a0.apName][marker0],
        m1 = z[a1.apName][marker1];
        console.log(marker0, marker1, a0.mapName, a0.apName, a1.mapName, a1.apName, m0.location, m1.location, direction, agName);
      }
    }
    function mmaa2text(mmaa)
    {
      let s = "";
      if ((mmaa === undefined) || (typeof mmaa == "string") || (mmaa.length === undefined))
        s += mmaa;
      else
      {
        let     [marker0, marker1, a0, a1, direction, agName] = mmaa,
        z = oa.z,
        m0 = z[a0.apName][marker0],
        m1 = z[a1.apName][marker1];
        s += marker0 + ", " + marker1 + ", " + a0.mapName + ", " + a0.apName + ", " + a1.mapName + ", " + a1.apName + ", " + m0.location + ", " + m1.location + ", " + direction + ", " + agName;
      }
      return s;
    }

    /** Collate adjacent APs, based on current stack adjacencies.
     */
    function collateAdjacentAPs()
    {
      adjAPs = oa.adjAPs = {};
      let stacks = oa.stacks;
      for (let stackIndex=0; stackIndex<stacks.length-1; stackIndex++) {
        let s0 = stacks[stackIndex], s1 = stacks[stackIndex+1],
        mAPs0 = s0.aps,
        mAPs1 = s1.aps;
        // Cross-product of the APs in two adjacent stacks
        for (let a0i=0; a0i < mAPs0.length; a0i++) {
          let a0 = mAPs0[a0i], za0 = a0.z, a0Name = a0.apName;
          if (a0Name === undefined)
          {
            console.log(mAPs0, mAPs1, a0i, a0);
          }
          for (let a1i=0; a1i < mAPs1.length; a1i++) {
            let a1 = mAPs1[a1i], za1 = a1.z;
            if (adjAPs[a0Name] === undefined)
              adjAPs[a0Name] = [];
            adjAPs[a0Name].push(a1.apName);
            if (adjacent_both_dir)
            {
              if (adjAPs[a1.apName] === undefined)
                adjAPs[a1.apName] = [];
              adjAPs[a1.apName].push(a0Name);
            }
          }
        }
      }
      if (trace_adj > 1)
        log_adjAPs(adjAPs);
      else if (trace_adj)
        console.log("collateAdjacentAPs", d3.keys(adjAPs).map(function (apName) { return APid2Name(apName);}));
    }
    function APid2Name(APid)
    {
      let aps = oa.aps;
      if (APid === undefined || aps[APid] === undefined)
      {
        console.log(aps, APid);
        debugger;
      }
      return aps[APid].mapName;
    }
    function log_adjAPs()
    {
      console.log("adjAPs");
      d3.keys(adjAPs).forEach(function(a0Name) {
        let a0 = adjAPs[a0Name];
        console.log(a0Name, APid2Name(a0Name), a0.length);
        for (let a1i=0; a1i < a0.length; a1i++) {
          let a1Name = a0[a1i];
          console.log(a1Name, APid2Name(a1Name));
        }
      });
    }
    function log_adjAPsa(adjs)
    {
      console.log("adjs", adjs.length);
      for (let a1i=0, a0=adjs; a1i < a0.length; a1i++) {
        let a1Name = a0[a1i];
        console.log(a1Name, APid2Name(a1Name));
      }
    }
    /** @return true if APs a0, a1 are adjacent, in either direction. */
    function isAdjacent(a0, a1)
    {
      let result = false, adjs0 = oa.adjAPs[a0];
      if (adjs0)
        for (let a1i=0; (a1i < adjs0.length) && !result; a1i++) {
          result = a1 == adjs0[a1i];
          if (result)
            console.log("isAdjacent", a0, APid2Name(a0), a1, APid2Name(a1));
      }
      return result;
    }

    /** Check if aliases between apName and apName1 have been stored.  */
    function getAliased(apName, apName1)
    {
      /* If there are aliases between apName, apName1 then
       * aliased[apName][apName1] (with apNames in lexicographic
       * order) will be defined, but because some adjacencies may not
       * have aliases, aliasedDone is used.
       */
      let a0, a1;
      if (! adjacent_both_dir && (apName > apName1))
      { a0 = apName1; a1 = apName; }
      else
      { a0 = apName; a1 = apName1; }
      let a = aliasedDone[a0] && aliasedDone[a0][a1];
      if (trace_adj > 1)
      {
        console.log("getAliased filter", apName, APid2Name(apName), apName1, APid2Name(apName1), a);
      }
      if (! a)
      {
        if (aliasedDone[a0] === undefined)
          aliasedDone[a0] = {};
        aliasedDone[a0][a1] = true;
      }
      return a;
    }

    /* This has a similar role to collateStacks1(), but is more broad - it just
     * looks at aliases and does not require symmetry; the filter can be customised to
     * require uniqueness, so this method may be as efficient and more general.
     *
     * for asymmetric aliases :
     * for each AP
     *   adjAPs = array (Set?) of adjacent APs, minus those already in tree[ap0]
     *   for each marker m0 in AP
     *     lookup aliases (markers) from m0 (could be to m0, but seems equiv)
     *       are those aliased markers in APs in adjAPs ?	(use mapping markerAPs[markerName] -> APs)
     *         add to tree, associate duplicates together (coming back the other way)
     *           by sorting ap0 & ap1 in lexicographic order.
     * 	         aliased[ap0][ap1][m0][m1]  : [m0, m1, ap0, ap1, direction, agName]
     *
     * call filterPaths() to collate paths of current adjacencies in put, accessed via Flow.pathData
     */
    function collateStacksA()
    {
      collateAdjacentAPs();
      let adjCount = 0, adjCountNew = 0, pathCount = 0;
      d3.keys(oa.z).forEach(
        function(apName)
        {
          let za = oa.z[apName];
          let adjs = adjAPs[apName];
          if (adjs && adjs.length
	      &&
              (adjs = adjs.filter(function(apName1) {
              adjCount++;
              let a = getAliased(apName, apName1);
              if (!a) adjCountNew++;
                return ! a; } ))
	      &&
	      adjs.length)
          {
            if (trace_adj > 1)
            {
              console.log(apName, APid2Name(apName));
              log_adjAPsa(adjs);
            }
            let trace_count = 1;
            d3.keys(za).forEach(
              function(markerName)
              {
                let  marker_ = za[markerName],
                agName = marker_.agName;

                let mas = marker_.aliases;
                for (let i=0; i<mas.length; i++)
                {
                  let mi = mas[i],
                  markerAPs = oa.markerAPs,
                  APs = markerAPs[mi];
                  // APs will be undefined if mi is not in a AP which is displayed.
                  if (APs === undefined)
                  {
                    if (trace_adj && trace_count-- > 0)
                      console.log("collateStacksA", "APs === undefined", apName, adjs, markerName, marker_, i, mi, markerAPs);
                  }
                  else
                    // is there an intersection of adjs with APs
                    for (let id=0; id<adjs.length; id++)
                  {
                      let aj = adjs[id],
                      markerA = oa.z[aj][mi];
                      if (APs.has(aj))
                      {
                        let // agName = markerA.agName,
                          direction = apName < aj,
                        aps = oa.aps,
                        apName_ = aps[apName],
                        aj_ = aps[aj],
                        am = [
                          {m: markerName, ap: apName_},
                          {m: mi, ap: aj_}
                        ],
                        am_= [am[1-direction], am[0+direction]],
                        [m0, m1, ap0, ap1] = [am_[0].m, am_[1].m, am_[0].ap, am_[1].ap],
                        mmaa = [m0, m1, ap0, ap1, direction, agName];
                        if (trace_adj && trace_count-- > 0)
                          console.log("mmaa", mmaa, ap0.apName, ap1.apName, APid2Name(ap0.apName), APid2Name(ap1.apName));
                        // log_mmaa(mmaa);
                        // aliased[ap0][ap1][m0][m1] = mmaa;
                        /* objPut() can initialise aliased, but that is done above,
                         * needed by filter, so result is not used. */
                        objPut(aliased, mmaa, ap0.apName, ap1.apName, m0, m1);
                        pathCount++;
                      }
                    }
                }

              });
          }
        });
      if (trace_adj)
        console.log("adjCount", adjCount, adjCountNew, pathCount);
      // uses (calculated in) collateAdjacentAPs() : adjAPs, collateStacksA() : aliased.
      filterPaths();
    }

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
      A.push(v);
      return a;
    }
    /**
     * Results are in put, which is accessed via Flow.pathData
     */
    function filterPaths()
    {
      put = flows.alias.pathData = [];
      function selectCurrentAdjPaths(a0Name)
      {
        // this could be enabled by trace_adj also
        if (trace_path > 1)
          console.log("a0Name", a0Name, APid2Name(a0Name));
        adjAPs[a0Name].forEach(function (a1Name) { 
          if (trace_path > 1)
            console.log("a1Name", a1Name, APid2Name(a1Name));
          let b;
          if ((b = aliased[a0Name]) && (b = b[a1Name]))
            d3.keys(b).forEach(function (m0) {
              let b0=b[m0];
              d3.keys(b0).forEach(function (m1) {
                let b01=b0[m1];
                let mmaa = b01;
                // filter here, e.g. uniqueness
                if (trace_path > 1)
                {
                  console.log(put.length, m0, m1, mmaa.length);
                  log_mmaa(mmaa[0]);
                }
                put.push.apply(put, mmaa);
              });
            });
        });
      };
      if (trace_path > 1)
        console.log("selectCurrentAdjPaths.length", selectCurrentAdjPaths.length);
      d3.keys(adjAPs).forEach(selectCurrentAdjPaths);
      console.log("filterPaths", put.length);
    }

    /**
     * compile map of marker -> array of APs
     *  array of { stack{APs...} ... }
     * stacks change, but APs/chromosomes are changed only when page refresh
     */
    function collateMarkerMap()
    {
      console.log("collateMarkerMap()");
      if (am === undefined)
        am = {};
      aa || (aa = {});
      let z = oa.z;
      for (let ap in z)
      {
        for (let marker in z[ap])
        {
          // console.log(ap, marker);
          if (am[marker] === undefined)
            am[marker] = [];
          am[marker].push(ap);
        }
        /* use marker aliases to match makers */
        Object.entries(z[ap]).forEach
        (
          /** marker is the marker name, m is the marker object in z[].  */
          function ([marker, m])
          {
            /** m.aliases is undefined for z entries created via an alias. */
            let a = m.aliases;
            // console.log(marker, a);
            if (a)
              for (let ai=0; ai < a.length; ai++)
            {
                let alias = a[ai];
                // use an arbitrary order (marker name), to reduce duplicate paths
                if (alias < marker)
                {
                  aa[alias] || (aa[alias] = []);
                  aa[alias].push(ap);
                }
              }
          }
        );
      }
    }


    /** given 2 arrays of marker names, concat them and remove duplicates */
    function concatAndUnique(a, b)
    {
      let c = a || [];
      if (b) c = c.concat(b);
      let cu = [...new Set(c)];
      return cu;
    }

    /** Return an array of APs contain Marker `marker` and are in stack `stackIndex`.
     * @param marker  name of marker
     * @param stackIndex  index into stacks[]
     * @return array of APs
     */
    function markerStackAPs(marker, stackIndex)
    {
      /** smi are the APs selected by marker. */
      let stack = oa.stacks[stackIndex], smi=concatAndUnique(aa[marker], am[marker]);
      // console.log("markerStackAPs()", marker, stackIndex, smi);
      let mAPs = smi.filter(function (apID) {
        let mInS = stack.contains(apID); return mInS; });
      // console.log(mAPs);
      return mAPs;
    }
    /** A line between a marker's location in adjacent APs.
     * @param k1, k2 indices into apIDs[]
     * @param d marker name
     */
    function markerLine2(k1, k2, d)
    {
      let
        o = oa.o,
        ak1 = oa.apIDs[k1],
        ak2 = oa.apIDs[k2];
      return line([[o[ak1], markerY(k1, d)],
                   [o[ak2], markerY(k2, d)]]);
    }
    /** Stacks version of markerLine2().
     * A line between a marker's location in APs in adjacent Stacks.
     * @param ak1, ak2 AP names, (exist in apIDs[])
     * @param d1, d2 marker names, i.e. ak1:d1, ak1:d1
     * If d1 != d2, they are connected by an alias.
     */
    function markerLineS2(ak1, ak2, d1, d2)
    {
      let o = oa.o;
      // o[p], the map location,
      return line([[o[ak1], markerY_(ak1, d1)],
                   [o[ak2], markerY_(ak2, d2)]]);
    }
    /** Show a parallelogram between 2 axes, defined by
     * 4 marker locations in APs in adjacent Stacks.
     * Like @see markerLineS2().
     * @param ak1, ak2 AP names, (exist in apIDs[])
     * @param d[0 .. 3] marker names, i.e. ak1:d[0] and d[1], ak2:d[2] and d[3]
     */
    function markerLineS3(ak1, ak2, d)
    {
      let o = oa.o, oak = [x(ak1), x(ak2)], // o[ak1], o[ak2]],
      p = [[oak[0], markerY_(ak1, d[0])],
           [oak[0], markerY_(ak1, d[1])],
           // order swapped in ak2 so that 2nd point of ak1 is adjacent 2nd point of ak2
           [oak[1], markerY_(ak2, d[3])],
           [oak[1], markerY_(ak2, d[2])],
          ],
      sLine = line(p) + "Z";
      if (trace_synteny > 4)
        console.log("markerLineS3", ak1, ak2, d, oak, p, sLine);
      return sLine;
    }

    /** Similar to @see markerLine().
     * Draw a horizontal notch at the marker location on the axis.
     * Used when showAll and the marker is not in a AP of an adjacent Stack.
     * @param ak apID
     * @param d marker name
     * @param xOffset add&subtract to x value, measured in pixels
     */
    function markerLineS(ak, d, xOffset)
    {
      let akY = markerY_(ak, d);
      let shiftRight = 9;
      let o = oa.o;
      return line([[o[ak]-xOffset + shiftRight, akY],
                   [o[ak]+xOffset + shiftRight, akY]]);
    }
    /** calculate SVG line path for an horizontal line.
     *
     * Currently this is used for paths within axis group elt,
     * which is within stack elt, which has an x translation,
     * so the path x position is relative to 0.
     *
     * @param ak apID.
     * @param akY Y	position (relative to AP of ak?)
     * @param xOffset add&subtract to x value, measured in pixels
     * Tick length is 2 * xOffset, centred on the axis + shiftRight.
     * @return line path for an horizontal line.
     * Derived from markerLineS(), can be used to factor it and markerLine()
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
    /** Similar to @see markerLine2().
     * @param k index into apIDs[]
     * @param d marker name
     * @param xOffset add&subtract to x value, measured in pixels
     */
    function markerLine(k, d, xOffset)
    {
      let ak = oa.apIDs[k],
      akY = markerY(k, d);
      let o = oa.o;
      return line([[o[ak]-xOffset, akY],
                   [o[ak]+xOffset, akY]]);
    }
    /**
     * change to use marker alias group as data of path;
     *  for non-aliased markers, data remains as marker - unchanged
     * 
     * when stack adjacency changes (i.e. drop in/out, dragended) :
     * 
     * compile a list, indexed by marker names,
     *   array of
     *     AP from / to (optional : stack index from / to)
     * 
     * compile a list, indexed by marker alias group names (catenation of aliased marker names),
     *   marker name
     *   array of
     *     AP from / to (optional : stack index from / to)
     * 
     * I think these will use 2 variants of markerStackAPs() : one using am[] and the other aa[].
     * Thinking about what the hover text should be for paths drawn due to an alias - the alias group (all names), or maybe the 2 actual markers.
     * that is why I think I'll need 2 variants.
     * 
     * path()
     *   based on the current path(), retain the part inside the 3rd nested for();
     *   the remainder (outer part) is used to as the basis of the above 2 collations.
     * 
     * More detail in collateData() and collateStacks().
     */

    /** Replaced by collateStacks(). */
    function collateMagm(d) // d is markerName
    {
      /* This method originated in path(markerName), i.e. it starts from a given markerName;
       * in next version this can be re-written to walk through :
       *  all adjacent pairs of stacks  :
       *   all APs of those stacks :
       *    all markers of those APs
       */
      for (let stackIndex=0; stackIndex<oa.stacks.length-1; stackIndex++) {
        let mAPs0 = markerStackAPs(d, stackIndex),
        mAPs1 = markerStackAPs(d, stackIndex+1);
        // Cross-product of the two adjacent stacks; just the APs which contain the marker.
        for (let a0i=0; a0i < mAPs0.length; a0i++) {
          let a0 = mAPs0[a0i];
          for (let a1i=0; a1i < mAPs1.length; a1i++) {
            let a1 = mAPs1[a1i];
            if (maga[d] === undefined)
              maga[d] = [];
            maga[d].push([stackIndex, a0, a1]);
          }
        }
      }
    }

    /** This is the stacks equivalent of path() / zoompath().
     * Returns an array of paths (links between APs) for a given marker.
     */
    function path(markerName) {
      let r = [];
      // TODO : discard markers of the paths which change
      // pathMarkers = {};

      /** 1 string per path segment */
      let
        mmNm = oa.maN[markerName];
      if (mmNm !== undefined)
        /* console.log("path", markerName);
         else */
        if ((unique_1_1_mapping === 2) && (mmNm.length > 1))
      { /* console.log("path : multiple", markerName, mmNm.length, mmNm); */ }
      else
        for (let i=0; i < mmNm.length; i++)
      {
          let [markerName, a0_, a1_, za0, za1] = mmNm[i];
          let a0 = a0_.apName, a1 = a1_.apName;
          if ((za0 !== za1) && (a0 == a1))
            console.log("path", i, markerName, za0, za1, a0, a1);
          r[i] = patham(a0, a1, markerName, undefined);
        }
      if (trace_path > 3)
        console.log("path", markerName, mmNm, r);
      if (r.length == 0)
        r.push("");
      return r;
    }

    /** for unique paths between markers, which may be connected by alias,
     * data is [marker0, marker1, a0, a1]
     * Enabled by unique_1_1_mapping.
     * @param mmaa  [marker0, marker1, a0, a1]
     */
    function pathU(mmaa) {
      if ((mmaa === undefined) || (mmaa.length === undefined))
      { console.log("pathU", this, mmaa); debugger; }
      let [marker0, marker1, a0, a1] = mmaa;
      let p = [];
      p[0] = patham(a0.apName, a1.apName, marker0, marker1);
      if (trace_path > 1)
        console.log("pathU", mmaa, a0.mapName, a1.mapName, p[0]);
      return p;
    }
    function pathUg(d) {
      let mmaa = dataOfPath(this),
      p = pathU(mmaa);
      if (trace_path > 2)
        console.log(this, d);
      return p;
    }

    /** TODO : for paths with alias group as data
     * @param ag   alias group (name)?
     */
    function pathAg(ag) {
      /** 1 string per path segment */
      let p = [],
      agama = agam[ag]; // to be passed from collateStacks().
      if (agama === undefined)
        console.log("pathAg", ag);
      else
        for (let i=0; i < agama.length; i++)
      {
          let [markerName, a0, a1, za0, za1] = agama[i];
          p[i] = patham(a0.apName, a1.apName, markerName, undefined);
        }
      return p.join();
    }

    /** Calculate relative location of marker markerName in the AP apID, and
     * check if it is inRange 
     * @param apID  ID of Axis Piece
     * @param markerName  marker within apID
     * @param range e.g. [0, yRange]
     */
    function inRangeI(apID, markerName, range)
    {
      return inRange(markerY_(apID, markerName), range);
    }

    /** @param m  marker reference i.e. z[apName][markerName]]
     * @return text for display in path hover tooltip */
    function markerAliasesText(mN, m)
    {
      let s = mN + ":" + m.aliases.length + ":",
      mas = m.aliases;
      for (let i=0; i<mas.length; i++)
      {
        s += mas[i] + ",";
      }
      // console.log("markerAliasesText", mN, m, mas, s);
      return s;
    }

    /** Prepare a tool-tip for the line.
     * The line / path may be either connecting 2 axes, or a tick on one axis;
     * in the latter case ma1 will be undefined.
     * @param sLine svg path text
     * @param d0, d1 marker names, i.e. a0:m0, a1:m1.
     * Iff d1!==undefined, they are connected by an alias.
     * @param ma0, ma1  marker objects.
     * ma1 will be undefined when called from axisMarkerTick()
     */
    function pathMarkerStore(sLine, d0, d1, ma0, ma1)
    {
      let pathMarkers = oa.pathMarkers;
      if (pathMarkers[sLine] === undefined)
        pathMarkers[sLine] = {};

      /** Show the x,y coords of the endpoints of the path segment.  Useful during devel. */
      const showHoverLineCoords = false;
      const showHoverAliases = true;
      /** 1 signifies the normal behaviour - handleMouseOver() will show just the marker name.
       * Values other than 1 will be appended as text. */
      let hoverExtraText = showHoverExtraText ?
        " " + ma0.location +
        (ma1 ?  "-" + ma1.location : "")
        + (showHoverLineCoords ? " " + sLine : "")
      : 1;
      if (showHoverExtraText && showHoverAliases)
      {
        hoverExtraText += 
          "<div>" + markerAliasesText(d0, ma0) + "</div>" +
          (d1 && ma1 ? 
           "<div>" + markerAliasesText(d1, ma1) + "</div>" : "");
      }
      let d = d1 && (d1 != d0) ? d0 + "_" + d1: d0;
      pathMarkers[sLine][d] = hoverExtraText; // 1;
    }

    /**
     * @param  a0, a1  AP names
     * @param d0, d1 marker names, i.e. a0:d0, a1:d1.
     * Iff d1!==undefined, they are connected by an alias.
     */
    function patham(a0, a1, d0, d1) {
      // let [stackIndex, a0, a1] = maga[d];
      let r;

      let range = [0, yRange];

      /** if d1 is undefined, then its value is d0 : direct connection, not alias. */
      let d1_ = d1 || d0;
      /** Filter out those paths that either side locates out of the svg. */
      let lineIn = allowPathsOutsideZoom ||
        (inRangeI(a0, d0, range)
         && inRangeI(a1, d1_, range));
      // console.log("path()", stackIndex, a0, allowPathsOutsideZoom, inRangeI(a0), inRangeI(a1), lineIn);
      if (lineIn)
      {
        let sLine = markerLineS2(a0, a1, d0, d1_);
        let cmName = oa.cmName;
        let marker0 = d0, marker1 = d1, traceTarget = marker0 == "markerK" && marker1 == "markerK" &&
          cmName[a0].mapName == "MyMap5" && cmName[a1].mapName == "MyMap6";
        if (traceTarget)
        {
          console.log("patham()", d0, d1, cmName[a0].mapName, cmName[a1].mapName, a0, a1, z[a0][d0].location, d1 && z[a1][d1].location, sLine);
        }
        else if (trace_path > 4)
          console.log("patham()", d0, d1, cmName[a0] && cmName[a0].mapName, cmName[a1] && cmName[a1].mapName, a0, a1, z && z[a0] && z[a0][d0] && z[a0][d0].location, d1 && z && z[a1] && z[a1][d1] && z[a1][d1].location, sLine);          
        r = sLine;
        let z = oa.z;
        if (pathDataIsLine)
          /* Prepare a tool-tip for the line. */
          pathMarkerStore(sLine, d0, d1, z[a0][d0], z[a1][d1_]);
      }
      else if (showAll) {
        const markerTickLen = 10; // orig 5
        function axisMarkerTick(ai, d) {
          let z = oa.z;
          if (d in z[a0])
          {
            r = markerLineS(ai, d, markerTickLen);
            pathMarkerStore(r, d, d, z[ai][d], undefined);
          }
        }
        // could filter these according to inRangeI() as above
        axisMarkerTick(a0, d0);
        axisMarkerTick(a1, d1_);
      }
      return r;
    }
    /**
     * @param  a0, a1  AP names
     * @param d[0 .. 3], marker names, i.e. a0:d[0]-d[1], a1:d[2]-d[3].
     * Unlike patham(), d does not contain undefined.
     */
    function patham2(a0, a1, d) {
      let r;
      let range = [0, yRange];

      /** Filter out those parallelograms which are wholly outside the svg, because of zooming on either end axis. */
      let lineIn = allowPathsOutsideZoom ||
        (inRangeI(a0, d[0], range)
         || inRangeI(a0, d[1], range)
         || inRangeI(a1, d[2], range)
         || inRangeI(a1, d[3], range));
      if (lineIn)
      {
        let sLine = markerLineS3(a0, a1, d);
        let cmName = oa.cmName;
        if (trace_synteny > 4)
          console.log("patham2()", d, cmName[a0] && cmName[a0].mapName, cmName[a1] && cmName[a1].mapName, a0, a1, z && z[a0] && z[a0][d[0]] && z[a0][d[0]].location, d[2] && z && z[a1] && z[a1][d[2]] && z[a1][d[2]].location, sLine);          
        r = sLine;
      }
      /* for showAll, perhaps change the lineIn condition : if one end is wholly
       * in and the other wholly out then show an open square bracket on the
       * axis which is in. */

      return r;
    }

    // Returns an array of paths (links between APs) for a given marker.
    // This predates the addition of stacks; probably no features here which are
    // not in the later functions path(), pathU().
    function path_pre_Stacks(d) { // d is a marker
      let r = [];
      let z = oa.z, pathMarkers = oa.pathMarkers;

      for (let k=0; k<oa.apIDs.length-1; k++) {
        let m_k  = oa.apIDs[k],
        m_k1 = oa.apIDs[k+1];
        if (d in z[m_k] && d in z[m_k1]) { // if markers is in both APs
          //Multiple markers can be in the same path
          let sLine = markerLine2(k, k+1, d);
          //pathMarkers[sLine][d] = 1;
          if(pathMarkers[sLine] != null){
            pathMarkers[sLine][d] = 1;
          } else {
            pathMarkers[sLine]= {};
            pathMarkers[sLine][d] = 1;
          }
          r.push(sLine);
        }
        else if (showAll) {
          if (d in z[m_k]) { 
            r.push(markerLine(k, d, 5));
          }
          if (d in z[m_k1]) {
            r.push(markerLine(k+1, d, 5));
          }
        }
      }
      return r;
    }

    /** Calculate relative marker location in the AP.
     * Result Y is relative to the stack, not the AP,
     * because .foreground does not have the AP transform (APs which are ends
     * of path will have different Y translations).
     *
     * @param apID name of AP  (exists in apIDs[])
     * @param d marker name
     */
    function markerY_(apID, d)
    {
      // z[p][m].location, actual position of marker m in the AP p, 
      // y[p](z[p][m].location) is the relative marker position in the svg
      // ys is used - the y scale for the stacked position&portion of the AP.
      let ysa = oa.ys[apID],
      aky = ysa(oa.z[apID][d].location),
      apY = oa.aps[apID].yOffset();
      if (! tracedApScale[apID])
      {
        tracedApScale[apID] = true;
        /* let yDomain = ysa.domain();
         console.log("markerY_", apID, d, z[apID][d].location, aky, apY, yDomain, ysa.range()); */
      }
      return aky + apY;
    }
    /** Calculate relative marker location in the AP
     * @param k index into apIDs[]
     * @param d marker name
     */
    function markerY(k, d)
    {
      return markerY_(oa.apIDs[k], d);
    }


    // Returns an array of paths (links between APs) for a given marker when zoom in starts.
    // This is the zoom() equivalent of path_pre_Stacks(); the features here are
    // most likely present in the later path() function/s;  zoom() now uses pathUpdate().
    function zoomPath(d) { // d is a marker
      let r = [];
      let z = oa.z, pathMarkers = oa.pathMarkers, o = oa.o;
      for (let k=0; k<oa.apIDs.length-1; k++) {
        //ys[p].domain
        //z[apIDs[k]][d].location marker location

        if (d in z[oa.apIDs[k]] && d in z[oa.apIDs[k+1]]) { // if markers is in both APs
          /** relative marker location in the AP of 2 markers, k and k+1 :
           * k  : markerYk[0]
           * k+1: markerYk[1]
           */
          let markerYk = [markerY(k, d), markerY(k+1, d)];
          // Filter out those paths that either side locates out of the svg
          if (inRange(markerYk[0], [0, yRange]) &&
              inRange(markerYk[1], [0, yRange])) {
            let sLine = line(
              [[o[oa.apIDs[k]], markerYk[0]],
               [o[oa.apIDs[k+1]], markerYk[1]]]);
            if(pathMarkers[sLine] != null){
              pathMarkers[sLine][d] = 1;
            } else {
              pathMarkers[sLine]= {};
              pathMarkers[sLine][d] = 1;
            }
            r.push(line(
              [[o[oa.apIDs[k]], markerYk[0]],
               [o[oa.apIDs[k+1]], markerYk[1]]]));
          } 
          
        } 
      }
      return r;
    }

    /** Used when the user completes a brush action on the AP axis.
     * The datum of g.brush is the ID/name of its AP, call this apID.
     * If null selection then remove apID from selectedAps[], otherwise add it.
     * Update selectedMarkers{}, brushedRegions{} : if selectedAps[] is empty, clear them.
     * Otherwise, set brushedRegions[apID] to the current selection (i.e. of the brush).
     * Set brushExtents[] to the brushedRegions[] of the APs in selectedAps[].
     * For each AP in selectedAps[], clear selectedMarkers{} then store in it the
     * names + locations of markers which are within the brush extent of the AP.
     * Add circle.apID for those marker locations.
     * Remove circles of markers (on all APs) outside brushExtents[apID].
     * For elements in '.foreground > g.flowName > g', set class .faded iff the marker (which
     * is the datum of the element) is not in the selectedMarkers[] of any AP.
     *
     * Draw buttons to zoom to the brushExtents (zoomSwitch) or discard the brush : resetSwitch.
     * Called from brushended(), which is called on(end) of axis brush.
     *
     * @param that  the brush g element.
     * The datum of `that` is the name/ID of the AP which owns the brushed axis.
     * 
     */
    function brushHelper(that) {
      // Chromosome name, e.g. 32-1B
      /** name[0] is apID of the brushed axis. name.length should be 1. */
      let name = d3.select(that).data();
      let brushedApID = name[0];

      let svgContainer = oa.svgContainer;
      //Remove old circles.
      svgContainer.selectAll("circle").remove();

      if (d3.event.selection == null) {
        selectedAps.removeObject(name[0]);
      }
      else {
        selectedAps.addObject(name[0]); 
      }

      // selectedAps is an array containing the IDs of the APs that
      // have been selected.
      
      if (selectedAps.length > 0) {
        console.log("Selected: ", " ", selectedAps.length);
        // APs have been selected - now work out selected markers.
        brushedRegions[name[0]] = d3.event.selection;
        brushExtents = selectedAps.map(function(p) { return brushedRegions[p]; }); // extents of active brushes

        selectedMarkers = {};
        let selectedMarkersSet = new Set();
        selectedAps.forEach(function(p, i) {
          /** d3 selection of one of the APs selected by user brush on axis. */
          let apS = oa.svgContainer.selectAll("#" + eltId(p));
          selectedMarkers[p] = [];

          let yp = oa.y[p],
          ap = oa.aps[p],
          brushedDomain = brushExtents[i].map(function(ypx) { return yp.invert(ypx /* *ap.portion */); });
          //console.log("brushHelper", name, p, yp.domain(), yp.range(), brushExtents[i], ap.portion, brushedDomain);

          d3.keys(oa.z[p]).forEach(function(m) {
            let z = oa.z;
            if ((z[p][m].location >= brushedDomain[0]) &&
                (z[p][m].location <= brushedDomain[1])) {
              //selectedMarkers[p].push(m);    
              selectedMarkersSet.add(m);
              selectedMarkers[p].push(m + " " + z[p][m].location);
              //Highlight the markers in the brushed regions
              //o[p], the ap location, z[p][m].location, actual marker position in the AP, 
              //y[p](z[p][m].location) is the relative marker position in the svg
              let dot = apS
                .append("circle")
                .attr("class", eltClassName(m))
                .attr("cx",0)   /* was o[p], but g.ap translation does x offset of stack.  */
                .attr("cy",oa.y[p](z[p][m].location))
                .attr("r",2)
                .style("fill", "red");

              
            } else {
              let m_ = eltClassName(m);
              apS.selectAll("circle." + m_).remove();
            }
          });
        });
        if (showSelectedMarkers)
          me.send('updatedSelectedMarkers', selectedMarkers);

        function markerNotSelected2(d)
        {
          let sel =
            unique_1_1_mapping && (typeof d != 'string') ?
            ( selectedMarkersSet.has(d[0]) ||
              selectedMarkersSet.has(d[1]) )
            : selectedMarkersSet.has(d);
          /* if (sel)
            console.log("markerNotSelected2", unique_1_1_mapping, d, selectedMarkersSet); */
          return ! sel;
        }

        d3.selectAll(".foreground > g > g").classed("faded", markerNotSelected2);

        /** d3 selection of the brushed AP. */
        let apS = svgContainer.selectAll("#" + eltId(name[0]));
        let zoomSwitchS = apS
          .selectAll('g.btn')
          .data([1]);
        let zoomSwitchE = zoomSwitchS
          .enter()
          .append('g')
          .attr('class', 'btn')
          .attr('transform', yAxisBtnScale);
        zoomSwitchE.append('rect');
        zoomSwitch = zoomSwitchS.merge(zoomSwitchE);
        let zoomResetSwitchTextE =
          zoomSwitchE.append('text')
          .attr('x', 30).attr('y', 20);
        let zoomResetSwitchText =
        zoomSwitch.selectAll('text')
          .text('Zoom');
        
        zoomSwitch.on('mousedown', function () {
          d3.event.stopPropagation();
        });
        zoomSwitch.on('click', function () {
          d3.event.stopPropagation();
          zoom(that,brushExtents);
          zoomed = true;

          //reset function
          //Remove all the existing circles
          oa.svgContainer.selectAll("circle").remove();
          zoomResetSwitchText
            .text('Reset');

          resetSwitch = zoomSwitch;
          resetSwitch.on('click',function(){resetZoom(brushedApID);
          });
          /* this need only be set once, can be set outside this callback.
           * for that, resetZoom() can be moved out of brushHelper():zoomSwitch.on()
           */
          me.set('resetZooms', function(markers) {
            resetZoom();
          });
          /** Reset 1 or all zooms.
           * @param apID  AP id to reset; undefined means reset all zoomed axes.
           */
          function resetZoom(apID)
          {
            let svgContainer = oa.svgContainer;
            let t = svgContainer.transition().duration(750);
            let apIDs = apID ? [apID] : oa.apIDs;
            apIDs.forEach(function(d) {
              let idName = axisEltId(d); // axis ids have "a" prefix
              let yDomainMax = d3.max(Object.keys(oa.z[d]), function(a) { return oa.z[d][a].location; } );
              oa.y[d].domain([0, yDomainMax]);
              oa.ys[d].domain([0, yDomainMax]);
              let yAxis = d3.axisLeft(oa.y[d]).ticks(10);
              oa.svgContainer.select("#"+idName).transition(t).call(yAxis);
            });
            let axisTickS = svgContainer.selectAll("g.axis > g.tick > text");
            axisTickS.attr("transform", yAxisTicksScale);
            axisStackChanged(t);

            pathUpdate(t);
            let resetScope = apID ? apS : svgContainer;
              resetScope.selectAll(".btn").remove();
            if (apID === undefined)
            {
              selectedMarkers = {};
              me.send('updatedSelectedMarkers', selectedMarkers);
            }
            zoomed = false; // not used
          }
        });
        
      } else {
        // brushHelper() is called from brushended() after zoom, with selectedAps.length===0
        // At this time it doesn't make sense to remove the resetSwitch button

        // No axis selected so reset fading of paths or circles.
        console.log("brushHelper", selectedAps.length);
        // some of this may be no longer required
        if (false)
          svgContainer.selectAll(".btn").remove();
        svgContainer.selectAll("circle").remove();
        d3.selectAll(".foreground > g > g").classed("faded", false);
        selectedMarkers = {};
        me.send('updatedSelectedMarkers', selectedMarkers);
        brushedRegions = {};
      }

    } // brushHelper

    /** Zoom the y axis of this AP to the given brushExtents[].
     * Called via on(click) of brushHelper() Zoom button (zoomSwitch).
     * Traverse selected APs, matching only the apName of the brushed AP.
     * Set the y domain of the AP, from the inverse mapping of the brush extent limits.
     * Remove the zoom button, redraw the axis, ticks, zoomPath. Move the brush.
     * @param that  the brush g element.
     * The datum of `that` is the name of the AP which owns the brushed axis.
     * @param brushExtents  limits of the current brush, to which we are zooming
     */
    function zoom(that, brushExtents) {
      let apName = d3.select(that).data();
      let t = oa.svgContainer.transition().duration(750);
      selectedAps.map(function(p, i) {
        if(p == apName){
          let y = oa.y, svgContainer = oa.svgContainer;
          let yp = y[p],
          ap = oa.aps[p],
          brushedDomain = brushExtents[i].map(function(ypx) { return yp.invert(ypx /* *ap.portion*/); });
          // brushedDomain = [yp.invert(brushExtents[i][0]), yp.invert(brushExtents[i][1])];
          console.log("zoom", apName, p, i, yp.domain(), yp.range(), brushExtents[i], ap.portion, brushedDomain);
          y[p].domain(brushedDomain);
          oa.ys[p].domain(brushedDomain);
          let yAxis = d3.axisLeft(y[p]).ticks(axisTicks * ap.portion);
          let idName = axisEltId(p);
          svgContainer.select("#"+idName).transition(t).call(yAxis);
          pathUpdate(t);
          // `that` refers to the brush g element
          d3.select(that).call(y[p].brush.move,null);
          let axisGS = svgContainer.selectAll("g.axis#" + axisEltId(p) + " > g.tick > text");
          axisGS.attr("transform", yAxisTicksScale);
        }
      });
      axisStackChanged(t);
    }

    function brushended() {
      // console.log("brush event ended");
      brushHelper(this);
    }


    function dragstarted(start_d /*, start_index, start_group*/) {
      Stack.currentDrop = undefined;
      Stack.currentDrag = start_d;
      // unique_1_1_mapping = me.get('isShowUnique'); // disable until button click does not redraw all.
      /** disable this as currently togglePathColourScale() sets pathColourScale as a boolean
       * maybe have a pull-down selector because multi-value.
       use_path_colour_scale = me.get('pathColourScale'); */
      console.log("dragstarted", this, start_d/*, start_index, start_group*/);
      let cl = {/*self: this,*/ d: start_d/*, index: start_index, group: start_group, apIDs: apIDs*/};
      let svgContainer = oa.svgContainer;
      svgContainer.classed("axisDrag", true);
      d3.select(this).classed("active", true);
      console.log(d3.event.subject.fx, d3.event.subject.x);
      d3.event.subject.fx = d3.event.subject.x;
      let apS = svgContainer.selectAll(".stack > .ap");
      if (apS && trace_stack)
        logSelection(apS);
      /* Assign class current to dropTarget-s depending on their relation to drag subject.
       add class 'current' to indicate which zones to get .dragHover
       axis being dragged does not get .current
       middle targets on side towards dragged axis don't
       axes i in 1..n,  dragged axis : dg
       current if dg != i && (! middle || ((side == left) == (i < dg)))
       * for (i < dg), use x(d) < startx
       */
      apS.selectAll('g.ap > g.stackDropTarget').classed
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

    /** @param  d (datum) name of AP being dragged.
     */
    function dragged(d) {
      /** Transition created to manage any changes. */
      let t;
      /** X distance from start of drag */
      let xDistance;
      let currentDropTarget = oa.currentDropTarget;
      if (dragging++ > 0) { console.log("dragged drop"); return;}
      if (! oa.svgContainer.classed("dragTransition"))
      {
        // if cursor is in top or bottom dropTarget-s, stack the AP,
        // otherwise set AP x to cursor x, and sort.
        let dropTargetEnd = currentDropTarget && currentDropTarget.classList.contains("end");

        const dropDelaySeconds = 0.5, milli = 1000;
        /** currentDrop references the apName being dragged and the stack it is dropped into or out of. */
        let currentDrop = Stack.currentDrop,
        /** Use the start of the drag, or the most recent drop */
        xDistanceRef = (currentDrop && currentDrop.x) ? currentDrop.x.stack : d3.event.subject.fx,
        now = Date.now();
        // console.log("dragged xDistanceRef", d3.event.x, currentDrop && currentDrop.x, xDistanceRef);
        // console.log("dragged", currentDrop, d);
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
            let targetApName = currentDropTarget.apName,
            top = currentDropTarget.classList.contains("top"),
            zoneParent = Stack.apStackIndex2(targetApName);
            /** destination stack */
            let stack = oa.stacks[zoneParent.stackIndex];
            if (! stack.contains(d))
            {
              t = dragTransitionNew();
              /*  .dropIn() and .dropOut() don't redraw the stacks they affect (source and destination), that is done here,
               * with this exception : .dropIn() redraws the source stack of the AP.
               */
              stack.dropIn(d, zoneParent.apIndex, top, t);
              breakPointEnable = 1;
              deleteAfterDrag();
              // apChangeGroupElt(d, t);
              collateStacks();
              // number of stacks has decreased - not essential to recalc the domain.
              Stack.log();
              stack.redraw(t);
            }
            // set x of dropped apID
          }
          // For the case : drag ended in a middle zone (or outside any DropTarget zone)
          // else if d is in a >1 stack then remove it else move the stack
          else if ((! currentDrop || !currentDrop.out)
                   && ((xDistance = Math.abs(d3.event.x - xDistanceRef)) > xDropOutDistance))
          {
            /** dragged AP, source stack */
            let ap = oa.aps[d], stack = ap.stack;
            if (currentDrop && currentDrop.stack !== stack)
            {
              console.log("dragged", d, currentDrop.stack, stack);
            }
            if (stack.aps.length > 1)
            {
              t = dragTransitionNew();
              stack.dropOut(d);
              Stack.log();
              // apChangeGroupElt(d, t);
              collateStacks();
              /* if d is not in currentDrop.stack (=== stack), which would be a
               * program error, dropOut() could return false; in that case stack
               * redraw() may have no effect.
               */
              stack.redraw(t);
              /* if AP is dropped out to a new stack, redraw now for
               * continuity, instead of waiting until dragended().
               */
              apRedrawText(aps[d]);
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
        // The boundary values are in dragLimit, defined previously.
        if (o[d] < dragLimit.min) { o[d] = dragLimit.min; }
        else if (o[d] > dragLimit.max) { o[d] = dragLimit.max; }
      }
      //console.log(apIDs + " " + o[d]);
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
        console.log("dragged", "stacks.changed", stacks.changed);
        stacks.changed ^= 0x01;
        axisStackChanged(undefined);
      }

      dragging--;
    } // dragged()

    /** Redraw the AP/axis which is being dragged.
     * Calls pathUpdate() which will mostly change the paths connected to the dragged axis;
     * but when dropIn/dropOut(), paths to other axes can be changed when stacking / adjacencies change.
     *
     * @param apElt  node/DOM element corresponding of AP. this of dragged()
     * @param d apName
     * @param t transition in which to make changes
     */
    function draggedAxisRedraw(apElt, d, t)
    {
      let st0 = d3.select(apElt);
      if (! st0.empty())
      {
        /* if (t === undefined)
         t = dragTransitionNew(); */
        // console.log("st0", st0._groups[0].length, st0._groups[0][0]);
        let st = st0; //.transition();  // t
        // st.ease(d3.easeQuadOut);
        // st.duration(dragTransitionTime);
        st.attr("transform", Stack.prototype.apTransformO);
        // zoomed affects transform via path() : apTransform.
        if (trace_path < 2)
          pathUpdate(t /*st*/);
        //Do we need to keep the brushed region when we drag the AP? probably not.
        //The highlighted markers together with the brushed regions will be removed once the dragging triggered.
        // st0.select(".brush").call(y[d].brush.move,null);
        //Remove all highlighted Markers.
        oa.svgContainer.selectAll("circle").remove();
      }
    }

    /** Called when apID has been dragged from one stack to another.
     * It is expected that the group element of the AP, g.ap#<eltId(apID)>,
     * needs to be moved from the source g.stack to destination.
     * @param apID name/id of AP
     * @param t drag transition
     */
    function apChangeGroupElt(apID, t)
    {
      let aS_ = "g.ap#" + eltId(apID),
      aS = t.selectAll(aS_),
      gStack = aS._groups[0][0].parentNode;
      // let p = t.select(function() { return gStack; });
      // console.log("apChangeGroupElt", apID, t, aS_, aS, p);
      // compare with ap->stack
      let ap = oa.aps[apID],
      stackID = ap.stack && ap.stack.stackID,
      /** destination Stack selection */
      dStack_ = "g.stack#" + stackEltId(ap.stack),
      dStackS = t.selectAll(dStack_),
      dStack = dStackS._groups[0][0], // equiv : .node()
      differentStack = gStack !== dStack;
      console.log("apChangeGroupElt", ap, stackID, dStack_, dStackS, dStack, differentStack);

      // not currently used - g.stack layer may be discarded.
      if (false && differentStack)
      {
        var removedGAp = aS.remove(),
        removedGApNode = removedGAp.node();
        console.log("removedGAp", removedGAp, removedGApNode);
        let dStackN = dStackS.node();
        // tried .append, .appendChild(), not working yet.
        if (dStackN && dStackN.append)
          //  dStackN.append(removedGApNode);
          dStackN.append(function() { return removedGApNode;});
      }
    }

    function fromSelectionArray(s, datum)
    {
      let a=[];
      for (let i=0; i<s.length; i++)
        a.push(datum ? s[i] && s[i].__data__ : s[i]);
      return a;
    }
    function logSelectionLevel(sl)
    {
      if (sl.length && sl[0].length)
      {
        console.log(fromSelectionArray(sl[0], false));
        console.log(fromSelectionArray(sl[0], true));
      }
    }
    function logSelection(s)
    {
      console.log(s, s._groups.length, s._parents.length);
      logSelectionLevel(s._groups);
      logSelectionLevel(s._parents);
    }

    function log_path_data(g)
    {
      let p3 = g.selectAll("g").selectAll("path");  // equiv : g.selectAll("g > path")
      console.log(p3._groups.length && p3._groups[0][0].__data__);
    }

    /** Update the paths connecting markers present in adjacent stacks.
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
      tracedApScale = {};  // re-enable trace
      let g = flow.g.selectAll("g");
      let gn;
      /* if (unique_1_1_mapping)
       {*/
      if (trace_path)
        console.log("pathUpdate() pathData", flow.name, pathData.length, g.size()); // , pathData
      if (trace_path > 1)
        for (let pi=0; pi < pathData.length; pi++)
          log_mmaa(pathData[pi]);
      g = g.data(pathData);
      if (trace_path)
        console.log("exit", g.exit().size(), "enter", g.enter().size());
      if (pathData.length === 0)
      {
        console.log("pathData.length === 0");
      }
      g.exit().remove();
      function log_foreground_g(selector)
      {
        let gg = oa.foreground.selectAll(selector);
        console.log("gg", selector, gg._groups[0], gg.size());
        if (true)
        {
          let gg0 = gg._groups[0];
          for (let gi=0; (gi < gg0.length) && (gi < 10); gi++)
          {
            log_mmaa(gg0[gi].__data__);
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
        // log_path_data(flow.g);
        let p2 = flow.g.selectAll("g").selectAll("path").data(path);
        // log_path_data(flow.g);
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
        log_foreground_g("g > g > path");
      (pathDataInG ? gn : pa)
      //.merge()
        .attr("class", pathClass);
      //}
      let
        path_ = unique_1_1_mapping ? (pathDataInG ? pathUg : pathU) : path,
      /** The data of g is marker name, data of path is SVG path string. */
      keyFn =function(d) { let markerName = markerNameOfPath(this); 
                           console.log("keyFn", d, this, markerName); 
                           return markerName; };
      /* The mmaa data of path's parent g is accessed from path attribute
       * functions (i.e. style(stroke), classed(reSelected), gKeyFn(), d, etc.);
       * alternately it could be stored in the path's datum and accessed
       * directly.  This would be needed if there were multiple path's within a
       * g elt.  There is incomplete draft of this (changing the data of path to
       * mmaa) in branch devel-path-data),
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
      if (pathData.length != (gp = d3.selectAll(".foreground > g." + flow.name + " > g > path")).size())
      {
        console.log("pathData.length", pathData.length, "!= gp.size()", gp.size());
      }

      // .merge() ...
      if (t === undefined) {t = d3; }
      if (true)
      {
        /** attr d function has not changed, but the data has.
         * even where the datum is the same, the axes may have moved.
         * So update all paths.
         */
        let t1=flow.g.transition(t),
        p1 = t1.selectAll("g > path"); // pa
        p1.attr("d", pathDataIsLine ? I : path_);
        if (trace_path > 3)
          log_path_data(flow.g);
        setupMouseHover(pa);
      }
      else
      {
        t.selectAll(".foreground > g." + flow.name + "> g > path").attr("d", function(d) { return d; });
        setupMouseHover(
          flow.g.selectAll("g > path")
        );
      }
      pathColourUpdate(pa, flow);
    }
    /** call pathUpdate(t) for each of the enabled flows. */
    function pathUpdate(t)
    {
      d3.keys(flows).forEach(function(flowName) {
        let flow = flows[flowName];
        if (flow.enabled)
          pathUpdate_(t, flow);
      });
    }
    /** Get the data corresponding to a path element, from its datum or its parent element's datum.
     * In the case of using aliases, the parent g's data is [m, m, ap, ap, ...] "mmaa".
     */
    function dataOfPath(path)
    {
      let pa = pathDataInG
        ? path.parentElement || path._parent /* EnterNode has _parent not parentElement */
        : path,
      da = pa.__data__;
      return da;
    }
    /** Get the markerName of a path element, from its corresponding data accessed via dataOfPath().
     */
    function markerNameOfPath(path)
    {
      let da = dataOfPath(path),
      markerName = markerNameOfData(da);
      return markerName;
    }
    /** If markerName has an alias group with a marker with an assigned class (colour) then return the classes.
     * @return undefined otherwise
     */
    function colouredAg(apName, markerName)
    {
      let classSet,
      marker = oa.z[apName][markerName],
      agName = marker.agName;
      if (agName)
      {
        classSet = agClasses[agName];
      }
      return classSet;
    }
    function classFromSet(classSet)
    {
      /** can use any element of set; later may cycle through them with slider. */
      let colourOrdinal = classSet.values().next().value;
      return colourOrdinal;
    }
    /** @param apName could be chrName : marker name is looked up via apName,
     * but intervals might be defined in terms of chrName; which is currently
     * the same thing, but potentially 1 chr could be presented by multiple axes.
     * see apName2Chr();
     * @return name of interval, as per makeIntervalName()
     * Later maybe multiple results if intervals overlap.
     */
    function locationClasses(apName, markerName)
    {
      let classes,
      m = oa.z[apName][markerName],
      location = m.location,
      chrName = apName2Chr(apName),
      mapChrName = APid2Name(apName) + ":" + chrName,
      it = intervalTree[apName];

      if (it)
        //Find all intervals containing query point
        it.queryPoint(location, function(interval) {
          /* later return Set or array of classes.  */
          classes = makeIntervalName(mapChrName, interval);
          if (trace_path_colour > 2)
            console.log("locationClasses", "apName", apName, "mapChrName", mapChrName, "markerName", markerName, ", scaffold/class", classes);
        });
      
      return classes;  
    }
    /** Access markerName/s from d or __data__ of parent g of path.
     * Currently only used when (use_path_colour_scale === 4), but aims to be more general.
     * Lookup markerScaffold to find class, or if (use_path_colour_scale === 4)
     * also look up colouredAg().  @see use_path_colour_scale

     * The scaffold of a marker was the first use; this has been generalised to a "class";
     * i.e. marker names are mapped (via colouredMarkers) to class names.
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
      let markerName = dataIsMmaa ? da[0] : da, // also @see markerNameOfPath(pathElt)
      colourOrdinal;
      if (use_path_colour_scale < 4)
      {
        colourOrdinal = markerName;
      }
      else if (use_path_colour_scale === 4)
      {
        colourOrdinal = markerScaffold[markerName];
        /* colour the path if either end has a class mapping defined.
         * if d[0] does not then check d[1].
         */
        if ((colourOrdinal === undefined) && dataIsMmaa
            && (da[0] != da[1]))
        {
          colourOrdinal = /*markerScaffold[da[0]] ||*/ markerScaffold[da[1]];
        }
        if (trace_path_colour > 2)
          console.log("markerName", markerName, ", scaffold/class", colourOrdinal);
      }
      else if (use_path_colour_scale === 5)
      {
        // currently, result of locationClasses() is a string identifying the interval,
        // and matching the domain value.
        if (dataIsMmaa)
        {
          classes = locationClasses(da[2].apName, markerName)
            || locationClasses(da[3].apName, da[1]);
        }
        else
        {
          let APs = oa.markerAPs[markerName], apName;
          // choose the first chromosome;  may be unique.
          // if not unique, could colour by the intervals on any of the APs,
          // but want just the APs which are points on this path.
          for (apName of APs) { break; }
          classes = locationClasses(apName, markerName);
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
         * markers in markerScaffold finds no class defined, lookup via
         * aliases of end markers - transitive.
         */
        /* if ! dataIsMmaa then have markerName but no APs; is result of a direct flow,
         * so colouring by Ag may not be useful.
         */
        // collateStacks() / maInMaAG() could record in pu the alias group of the path.
        let [marker0, marker1, a0, a1] = da;
        let classSet = colouredAg(a0.apName, marker0) || colouredAg(a1.apName, marker1);
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
            let markerName = dataIsMmaa ? da[0] : da, // also @see markerNameOfPath(this)
            colourOrdinal = markerName;
            if (use_path_colour_scale === 4)
            {
              colourOrdinal = markerScaffold[markerName];
              /* colour the path if either end has a class mapping defined.
               * if d[0] does not then check d[1].
               */
              if ((colourOrdinal === undefined) && dataIsMmaa
                  && (da[0] != da[1]))
              {
                colourOrdinal = markerScaffold[da[0]] || markerScaffold[da[1]];
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
              /* if ! dataIsMmaa then have markerName but no APs; is result of a direct flow,
               * so colouring by Ag may not be useful.
               */
              // collateStacks() / maInMaAG() could record in pu the alias group of the path.
              let [marker0, marker1, a0, a1] = da;
              let classSet = colouredAg(a0.apName, marker0) || colouredAg(a1.apName, marker1);
              if (classSet)
                colourOrdinal = classFromSet(classSet);
              if (false && colourOrdinal)
                console.log(markerName, da, "colourOrdinal", colourOrdinal);
            }
            if (colourOrdinal === undefined)
              colour = undefined;
            else
              colour = path_colour_scale(colourOrdinal);

            if (false && (colour !== pathColourDefault))  // change false to enable trace
              console.log("stroke", markerName, colourOrdinal, colour);
            return colour;
          });

      if (use_path_colour_scale === 3)
        gd.classed("reSelected", function(d, i, g) {
          /** d is path SVG line text */
          let da = dataOfPath(this);
          let dataIsMmaa = typeof(da) === "object";
          let markerName = dataIsMmaa ? da[0] : da;

          let pathColour = path_colour_scale(markerName);

          // console.log(markerName, pathColour, d, i, g);
          let isReSelected = pathColour !== pathColourDefault;
          return isReSelected;
        });

      if (use_path_colour_scale >= 4)
        gd.attr("class", function(d) {
          let scaffold, c,
          classes = pathClasses(this, d),
							simpleClass;
          if (simpleClass = (typeof(classes) !== "object"))
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
            console.log("class", this, markerNameOfPath(this), markerScaffold, scaffold, c, d);
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
    }
    /** recalculate stacks X position and show via transition
     * @param changedNum  true means the number of stacks has changed.
     * @param t undefined or transition to use for apTransformO change
     */
    function stacksAdjust(changedNum, t)
    {
      if (changedNum)
        collateO();
      collateStacks();
      if (changedNum)
      {
        if (t === undefined)
          t = d3.transition().duration(dragTransitionTime);
        t.selectAll(".ap").attr("transform", Stack.prototype.apTransformO);
        if (svgContainer)
          oa.stacks.forEach(function (s) { s.redrawAdjacencies(); });
      }
      // pathUpdate() uses flow.g, which is set after oa.foreground.
      if (oa.foreground && ysUpdated)
      {
        pathUpdate(t);
        countPathsWithData();
      }

      if (stacks.changed & 0x10)
      {
        console.log("stacksAdjust", "stacks.changed", stacks.changed);
        stacks.changed ^= 0x10;
        if (svgContainer === undefined)
          Ember.run.later(function () {
            axisStackChanged(t);
          });
        else
          axisStackChanged(t);
      }

      return t;
    }
    function dragended(/*d*/) {
      deleteAfterDrag();
      // in the case of dropOut(),
      // number of stacks has increased - need to recalc the domain, so that
      // x is defined for this AP.
      //
      // Order of apIDs may have changed so need to redefine x and o.
      updateXScale();
      // if caching, recalc : collateApPositions();
      
      let stacks = oa.stacks;
      stacks.sortLocation();
      /* stacks.changed only needs to be set if sortLocation() has changed the
       * order, so for an optimisation : define stacks.inOrder() using reduce(),
       * true if stacks are in location order.
       */
      stacks.changed = 0x10;
      let t = stacksAdjust(true, undefined);
      // already done in xScale()
      // x.domain(apIDs).range(axisXRange);
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
      xDropOutDistance_update();


      if (svgContainer.classed("dragTransition"))
      {
        console.log("dragended() dragTransition, end");
        dragTransition(false);
      }
      stacks.log();
    }
    

    /** flip the value of markers between the endpoints
     * @param markers is an array of marker names, created via (zoom) brush,
     * and input via text box
     */
    this.set('draw_flipRegion', function(markers) {
      let brushedMap, zm,
      selectedAps = oa.selectedAps;
      if (selectedAps.length === 0)
        console.log('draw_flipRegion', 'selectedAps is empty', selectedAps);
      else if ((brushedMap = selectedAps[0]) === undefined)
        console.log('draw_flipRegion', 'selectedAps[0] is undefined', selectedAps);
      else if ((zm = oa.z[brushedMap]) === undefined)
        console.log('draw_flipRegion', 'z[', brushedMap, '] is undefined', selectedAps, oa.z);
      else
      if (markers.length)
      {
        /** the first and last markers have the minimum and maximum position
         * values, except where flipRegion has already been applied. */
        let limits = [undefined, undefined];
        limits = markers
          .reduce(function(limits_, mi) {
            // console.log("reduce", mi, limits_, zm[mi]);
            // marker aliases may be in the selection and yet not in the map
            let zmi = zm[mi];
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

        let m0 = markers[0], m1 = markers[markers.length-1],
        locationRange = limits,
        /** delta of the locationRange interval */
        rd = locationRange[1] - locationRange[0],
        invert = function (l)
        {
          let i = rd === 0 ? l : locationRange[1] + (locationRange[0] - l);
          // console.log("invert", l, i);
          return i;
        };
        console.log("draw_flipRegion", /*markers, zm,*/ m0, m1, locationRange, rd);
        d3.keys(zm).forEach(function(marker) {
          let marker_ = zm[marker], ml = marker_.location;
          if (locationRange[0] <= ml && ml <= locationRange[1])
            marker_.location = invert(ml);
        });
        pathUpdate(undefined);
      }
    });

    this.set('clearScaffoldColours', function() {
      console.log("clearScaffoldColours");
      markerScaffold = {}, scaffolds = new Set(), scaffoldMarkers = {};
      agClasses = {};
      pathColourUpdate(undefined, undefined);
    });

    let apTitleSel = "g.ap > text";
      function glyphiconButton (className, id, glyphiconName, href) {
        return ''
              + '<button class="' + className + '" id="' + id + '" href="' + href + '">'
              + '<span class="glyphicon ' + glyphiconName + '" aria-hidden=true></span>'
              + '</button>';
      }
    /** Setup hover menus over AP titles.
     * So far used just for Delete
     * @see based on similar configurejQueryTooltip()
     */
    function  configureAPtitleMenu(apName) {
      if (trace_gui)
      console.log("configureAPtitleMenu", apName, this, this.outerHTML);
        let node_ = this;
      let remap = true;	// using the bundled glyphicon, getting jumbled order.
        Ember.$(node_)
        .popover({
            trigger : "hover", // manual", // "click focus",
          sticky: true,
          delay: {show: 200, hide: 1500},
          container: 'div#holder',
          placement : "auto bottom",
          // title : apName,
          html: true,
          content : ""
            + glyphiconButton("DeleteMap", "Delete_" + apName, remap ? "glyphicon-sound-7-1" : "glyphicon-remove-sign", "#")
            + glyphiconButton("ExtendMap", "Extend_" + apName, remap ? "glyphicon-star" : "glyphicon-arrow-right", "#")
        })
        // .popover('show');
      
        .on("shown.bs.popover", function(event) {
          if (trace_gui)
            console.log("shown.bs.popover", event, event.target);
          // button is not found when show.bs.popover, but is when shown.bs.popover.
          // Could select via id from <text> attr aria-describedby=​"popover800256".
          let deleteButtonS = d3.select("button.DeleteMap");
          if (trace_gui)
            console.log(deleteButtonS.empty(), deleteButtonS.node());
          deleteButtonS
            .on('click', function (buttonElt /*, i, g*/) {
              console.log("delete", apName, this);
              let ap = oa.aps[apName], stack = ap && ap.stack;
              // aps[apName] is deleted by removeStacked1() 
              let stackID = Stack.removeStacked(apName);
              deleteAPfromapIDs(apName);
              removeAPmaybeStack(apName, stackID, stack);
              me.send('mapsToViewDelete', apName);
            });

          let extendButtonS = d3.select("button.ExtendMap");
          if (trace_gui)
            console.log(extendButtonS.empty(), extendButtonS.node());
          extendButtonS
            .on('click', function (buttonElt /*, i, g*/) {
              console.log("extend", apName, this);
              let ap = oa.aps[apName], stack = ap && ap.stack;
              // toggle ap.extended, which is initially undefined.
              ap.extended = ! ap.extended;
              apShowExtend(ap, apName, undefined);
            });

        });
    }

    /** The Zoom & Reset buttons (g.btn) can be hidden by clicking the 'Publish
     * Mode' checkbox.  This provides a clear view of the visualisation
     * uncluttered by buttons and other GUI mechanisms
     */
    function setupToggle(checkboxId, onToggle)
    {
      let 
      checkbox = Ember.$("#" + checkboxId);
      checkbox.on('click', function (event) {
        let checked = checkbox[0].checked;
        console.log(checkboxId, checked, event.originalEvent);
        onToggle(checked);
      });
    }
    function dataReceivedCheck()
    {
        let dataReceived = me.get('dataReceived');
        console.log("toggleModePublish() : dataReceived", dataReceived);
        if (typeof dataReceived.length != "object")
        {
        let il = dataReceived.length-1, dr=dataReceived[il];
        console.log(dataReceived.length, dr[0]._internalModel, dr[1].record);
        dataReceived.push({ghi: 123});
        }
    }
    function setupToggleModePublish()
    {
      setupToggle
      ("checkbox-toggleModePublish",
      function (checked) {
        let svgContainer = oa.svgContainer;
        console.log(svgContainer._groups[0][0]);
        svgContainer.classed("publishMode", checked);
      }
      );
    }
    function setupToggleShowAll()
    {
      /* initial value of showAll is true, so .hbs has : checked="checked" */
      setupToggle
      ("checkbox-toggleShowAll",
      function (checked) {
        showAll = checked;
        pathUpdate(undefined);
      }
      );
    }
    function setupToggleShowSelectedMarkers()
    {
      /* initial value of showSelectedMarkers is true, so .hbs has : checked="checked" */
      setupToggle
      ("checkbox-toggleShowSelectedMarkers",
      function (checked) {
        showSelectedMarkers = checked;
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
      let input = Ember.$("#" + inputId);
      input.on('input', function (event) {
        let value = input[0].value / factor;
        console.log(inputId, value, event.originalEvent, oa.svgRoot._groups[0][0]);
        if (typeof varName == "string")
          setCssVariable(varName, value);
        else
          Ember.run.later(function () { varName(value); });
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
    function updateSbSizeThresh(value) {
      /** goal : aim is ~50 steps from 0 to 1000, with an initial/default value of 20.
       * base : x
       * x^50 = 1000 => 50 log(x) = log(1000) => x = e ^ log(1000) / 50
       * x = Math.pow(2.718, Math.log(1000) / 50) = 1.1481371748750222
       *	initial/default value of slider : y
       * x^y = 20 => y log(x) = log(20) => y = Math.log(20) / Math.log(1.148137) = 21.6861056
       * round to 22
       * so : in .hbs : id="range-sbSizeThreshold" :  min="0" max="50" value="22"
       *  min value is 0, so -1 to get 0. */
      oa.sbSizeThreshold=Math.pow(1.148137, value) - 1;
      Ember.run.later( function () { showSynteny(syntenyBlocks, undefined); });
    }
    function setupSbSizeThresh()
    {
      setupInputRange("range-sbSizeThreshold", updateSbSizeThresh, 1);
    }
    function setupVariousControls()
    {
      setupToggleShowAll();
      setupToggleShowSelectedMarkers();
      setupPathOpacity();
      setupPathWidth();
      setupSbSizeThresh();
    }

    function flows_showControls (parentSelector)
    {
      let parent = d3.select(parentSelector);
      let flowNames = d3.keys(flows);
      /** button to toggle flow visibilty. */
      let b = parent.selectAll("div.flowButton")
        .data(flowNames)
        .enter().append("div");
      b
        .attr("class",  function (flowName) { return flowName;})
        .classed("flowButton", true)
        .classed("selected", function (flowName) { let flow = flows[flowName]; return flow.visible;})
        .on('click', function (flowName /*, i, g*/) {
          let event = d3.event;
          console.log(flowName, event);
          // sharing click with Export menu
          if (event.shiftKey)
            return;
          // toggle visibilty
          let flow = flows[flowName];
          console.log('flow click', flow);
          flow.visible = ! flow.visible;
          let b1=d3.select(this);
          b1.classed("selected", flow.visible);
          updateSelections();
          flow.g.classed("hidden", ! flow.visible);
        })
      /* To get the hover text, it is sufficient to add attr title.
       * jQuery doc (https://jqueryui.com/tooltip/) indicates .tooltip() need
       * only be called once per document, perhaps that is already done by
       * d3 / jQuery / bootstrap.
       */
        .attr("title", I)
        .attr("data-id", function (flowName) {
          return "Export:" + flowName;
        })
      ;

    };
    flows_showControls(flowButtonsSel);
    configurejQueryTooltip(oa, flowButtonsSel);
    setupToggleModePublish();
    setupVariousControls();

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
      d3.keys(flows).forEach(function (flowName) {
        let flow = flows[flowName];
        console.log(flowName, " flow.g", flow.g._groups[0][0]);
        flow.g = oa.foreground.select("g." + flow.name);
        console.log(flowName, " flow.g", flow.g._groups[0][0]);
      });

    };

    function getUsePatchColour()
    {
      let inputParent = '#choose_path_colour_scale',
      inputs = Ember.$(inputParent + ' input'), val;
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

    Flow.prototype.ExportDataToDiv = function (eltSel)
    {
      let elts = Ember.$(eltSel), elt = elts[0];
      // or for text : elt.append()
      elt.innerHTML =
        "<div><h5>" + this.name + "</h5> : " + this.pathData.length + "</div>\n";
      this.pathData.forEach(function (mmaa) {
        let s = "<div>" + mmaa2text(mmaa) + "</div>\n";
        elt.insertAdjacentHTML('beforeend', s);
      });
    };


  },   // draw()


  didInsertElement() {
    eltWidthResizable('.draw-map-container');
    eltWidthResizable('.tabbed-table-container');
  },

  didRender() {
    // Called on re-render (eg: add another AP) so should call
    // draw each time.
    //
    let me = this;
    let data = this.get('data');
    let mapsDerived = this.get('mapsDerived');
    /** mapview.hbs passes Model=model to {{draw-map }}, just for devel trace -
     * the other parameters provide all the required information. */
    if (trace_promise > 1)
    {
    let Model = me.get('Model'),
    mp = Model.mapsPromise;
    mp.then(function (result) { console.log("mp", result); });
    }
    mapsDerived.then(function (mapsDerivedValue) {
      if (trace_promise > 1)
      {
      let availableMaps = me.get('availableMaps');
      console.log("Model", Model, "mapsDerivedValue.availableMaps", mapsDerivedValue.availableMaps);
      console.log("didRender", mapsDerivedValue);
      let mpr=mapsDerivedValue; // mp._result;
      console.log("mpr.availableChrs", mpr.availableChrs, "availableMaps", mpr.availableMaps, "selectedMaps", mpr.selectedMaps, "Model.mapsToView", Model.mapsToView);
      }
      me.draw(data, mapsDerived, 'didRender');
    });
  },

  resize() {
    // rerender each individual element with the new width+height of the parent node
    d3.select('svg')
    // need to recalc viewPort{} and all the sizes, (from document.documentElement.clientWidth,Height)
    // .attr('width', newWidth)
    ;
    //etc... and many lines of code depending upon how complex my visualisation is
  }

});

