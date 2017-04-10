import Ember from 'ember';

/* jshint curly : false */
/*global d3 */


export default Ember.Component.extend({

  actions: {
    updatedSelectedMarkers: function(selectedMarkers) {
      let markersAsArray = d3.keys(selectedMarkers)
        .map(function (key) {
          return selectedMarkers[key].map(function(marker) {
            //marker contains marker name and position, separated by " ".
            var info = marker.split(" ");
            return {Map:key,Marker:info[0],Position:info[1]};
          });
        })
        .reduce(function(a, b) { 
          return a.concat(b);
        }, []);
      // console.log(markersAsArray);
      // console.log("updatedSelectedMarkers in draw-map component");
      this.sendAction('updatedSelectedMarkers', markersAsArray);
    },

    updatedStacks: function(stacks) {
      let stacksText = stacks.toString();
      // stacks.log();
      // console.log("updatedStacks in draw-map component");
      // no effect :
      this.sendAction('updatedSelectedMarkers', stacksText);  // tacks
    },

    resizeView : function()
    {
      console.log("resizeView()");
      // resize();
    }

  },

  /** Draw the maps and paths between them.
   * @param myData array indexed by myMaps[*]; each value is a hash indexed by
   * <mapName>_<chromosomeName>, whose values are an array of markers {location,
   * map:<mapName>_<chromosomeName>, marker: markerName}
   *
   * @param myMaps array of map names
   */
  draw: function(myData) {

    // Draw functionality goes here.
    let me = this;

    /** Each stack contains 1 or more maps.
     * stacks are numbered from 0 at the left.
     * stack[i] is an array of Stack, which contains an array of Stacked,
     * which contains mapID & portion.
     */
    let stacks = [];
    /** Give each Stack a unique id so that its <g> can be selected. */
    let nextStackID = 0;
    /** Reference to all (Stacked) maps by mapName.
     */
    let maps = {};
    /// mapIDs are <mapName>_<chromosomeName>
    let mapIDs = d3.keys(myData);
    /** mapName of each chromosome, indexed by chr name. */
    let cmName = {};

/** Plan for layout of stacked axes.

graph : {chromosome{linkageGroup{}+}*}

graph : >=0  chromosome-s layed out horizontally

chromosome : >=1 linkageGroup-s layed out vertically:
  catenated, use all the space, split space equally by default,
  can adjust space assigned to each linkageGroup (thumb drag) 
*/

    const dragTransitionTime = 1000;  // milliseconds

    /// width in pixels of the axisHeaderText, which is
    /// 30 chars when the map name contains the 24 hex char mongodb numeric id,
    /// e.g. 58a29c715a9b3a3d3242fe70_MyChr
    let axisHeaderTextLen = 203.5;
    //margins, width and height (defined but not be used)
    let m = [10+14+1, 10, 10, 10],	// margins : top right bottom left
    marginIndex = {top:0, right:1, bottom:2, left:3},	// indices into m[]; standard CSS sequence.
    viewPort = {w: document.documentElement.clientWidth, h:document.documentElement.clientHeight},

	  /// small offset from axis end so it can be visually distinguished.
    dropTargetYMargin = 10,
    dropTargetXMargin = 10,

    /// Width and Height.  viewport dimensions - margins.
    w = viewPort.w  - m[marginIndex.right] - m[marginIndex.left],
    h = viewPort.h - m[marginIndex.top] - m[marginIndex.bottom],
    /// approx height of map / chromosome selection buttons above graph
    mapSelectionHeight = 140,
    /// approx height of text name of map+chromosome displayed above axis.
    mapNameHeight = 14,
    /// approx height of text block below graph which says 'n selected markers'
    selectedMarkersTextHeight = 14,
    /// dimensions of the graph border
    graphDim = {w: w*0.6, h: h - 2 * dropTargetYMargin - mapSelectionHeight - mapNameHeight - selectedMarkersTextHeight},
    /// yRange is the axis length
    yRange = graphDim.h - 40,
    /** X Distance user is required to drag axis before it drops out of Stack.
     * Based on stacks.length, use mapIDs.length until the stacks are formed.
     * See also DropTarget.size.w */
    xDropOutDistance = viewPort.w/(mapIDs.length*6),
    /// left and right limits of dragging the axes / chromosomes / linkage-groups.
    dragLimit = {min:-50, max:graphDim.w+70};
    console.log("viewPort=", viewPort, ", w=", w, ", h=", h, ", graphDim=", graphDim, ", yRange=", yRange);
    /// pixels.  can calculate this from map name * font width
    let
    /// x range of the axis centres. left space at left and right for
    /// axisHeaderTextLen which is centred on the axis.
    /// index: 0:left, 1:right
    axisXRange = [0 + axisHeaderTextLen/2, graphDim.w - axisHeaderTextLen/2];
    let
      /** number of ticks in y axis when map is not stacked.  reduce this
       * proportionately when map is stacked. */
      axisTicks = 10,
    /** font-size of y axis ticks */
    axisFontSize = 12;

     function xDropOutDistance_update () {
       xDropOutDistance = viewPort.w/(stacks.length*6);
     }

    /** Draw paths between markers on maps even if one end of the path is outside the svg.
     * This was the behaviour of an earlier version of this Marker Map Viewer, and it
     * seems useful, especially with a transition, to show the progressive exclusion of
     * paths during zoom.n
     */
    let allowPathsOutsideZoom = false;

    /** When working with aliases: only show unique connections between markers of adjacent maps.
     * Markers are unique within maps, so this is always the case when there are no aliases.
     * Counting the connections (paths) between markers based on aliases + direct connections,
     * if there is only 1 connection between a pair of markers, i.e. the mapping between the maps is 1:1,
     * then show the connection.
     */
    let unique_1_1_mapping = true;

    /** Apply colours to the paths according to their marker name (datum); repeating ordinal scale.  */
    let use_path_colour_scale = true;

    /** Enable display of extra info in the path hover (@see hoverExtraText).
     * Currently a debugging / devel feature, will probably re-purpose to display metadata.
     */
    let showHoverExtraText = true;

    let
    /** y[mapID] is the scale for map mapID.
     * y[mapID] has range [0, yRange], i.e. as if the map is not stacked.
     * g.map has a transform to position the map within its stack, so this scale is used
     * for objects within g.map, and notably its child g.axis, such as the brush.
     * For objects in g.foreground, ys is the appropriate scale to use.
     */
    y = {},
    /** ys[mapID] is is the same as y[mapID], with added translation and scale
     * for the map's current stacking (map.position, map.yOffset(), map.portion).
     * See also comments for y re. the difference in uses of y and ys.
     */
    ys = {},
    /** Count markers in maps, to set stronger paths than normal when working
     * with small data sets during devel.  */
    markerTotal = 0,
        /** z[mapId] is a hash for map mapId mapping marker name to location.
         * i.e. z[d.map][d.marker] is the location of d.marker in d.map.
         */
        z = myData,
        /** All marker names.
         * Initially a set (to determine unique names), then converted to an array.
         */
        d3Markers = new Set();
    d3.keys(myData).forEach(function(map) {
      /** map is chr name */
      let c = myData[map];
      cmName[map] = {mapName : c.mapName, chrName : c.chrName};
      delete c.mapName;
      delete c.chrName;
      // console.log(map, cmName[map]);
      d3.keys(myData[map]).forEach(function(marker) {
        d3Markers.add(marker);
        markerTotal++;

        let markerValue = myData[map][marker];
        if (markerValue && markerValue.aliases)
        for (let a of markerValue.aliases)
        {
          z[map][a] = {location: markerValue.location};
        }

      });
    });
    //creates a new Array instance from an array-like or iterable object.
    d3Markers = Array.from(d3Markers);
    /** the name markers can replace d3Markers, in next commit. */
    let markers = d3Markers;
    let
      /** Draw a horizontal notch at the marker location on the axis,
       * when the marker is not in a map of an adjacent Stack.
       * Makes the marker location visible, because otherwise there is no path to indicate it.
       */
      showAll = true;

    /** Alias groups : ag[ag] : [ marker ]    marker references map and array of aliases */
    let ag = {};

    /** Map from marker names to map names.
     * Compiled by collateMarkerMap() from z[], which is compiled from d3Data.
     */
    let mm;
    /** Map from marker names to map names, via aliases of the marker.
     * Compiled by collateMarkerMap() from z[], which is compiled from d3Data.
     */
    let mma;

    // results of collateData()
    let
      /** map / alias : marker    mam[map][alias group] : marker */
      mam = {},
    /** map/marker : alias groups       mmag[map][marker] : [ag]  */
    mmag = {},
        /** marker alias groups maps */
    magm = {};

    // results of collateStacks()
    let
    /** marker : map - map    mmN[marker] : [[marker, marker]] */
    mmN = {},
    agmm = {};

    let line = d3.line(),
        axis = d3.axisLeft(),
        foreground,
        // brushActives = [],
        /** Extent of current brush (applied to y axis of a map). */
        brushExtents = [];
    /** guard against repeated drag event before previous dragged() has returned. */
    let dragging = 0;
    /** trace scale of each map just once after this is cleared.  */
    let tracedMapScale = {};


    /**
     * @return true if a is in the closed interval range[]
     * @param a value
     * @param range array of 2 values - limits of range.
     */
    function inRange(a, range)
    {
      return range[0] <= a && a <= range[1];
    }

    /** Used for group element, class "map"; required because id may start with
     * numeric mongodb id (of geneticmap) and element id cannot start with
     * numeric.
     * Also used for g.stack, which is given a numeric id (@see nextStackID).
     * Not required for axis element ids because they have "m" suffix.
     */
    function eltId(name)
    {
      return "id" + name;
    }
    /** id of axis g element, based on mapName, with an "m" prefix. */
    function axisEltId(name)
    {
      return "m" + name;
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
    /** Signal the start or end of a drag transition, i.e. a map is dragged from
     * one Stack to another - dropIn() or dropOut().
     * During this transition, 
     * @param start signifies start (true) or end (false) of drag transition.
     */
    function dragTransition(start)
    {
      if (start)
        console.log("dragTransition(start)");
      svgContainer.classed("dragTransition", start);
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
    const trace_stack = 1;
    function Stacked(mapName, portion) {
      this.mapName = mapName;
      /** Portion of the Stack height which this map axis occupies. */
      this.portion = portion;
      // The following are derived attributes.
      /** .position is accumulated from .portion.
       * .position is [start, end], relative to the same space as portion.
       * i.e. .portion = (end - start) / (sum of .portion for all maps in the same Stack).
       * Initially, each map is in a Stack by itself, .portion === 1, so
       * .position is the whole axis [0, 1].
       */
      this.position = (portion === 1) ? [0, 1] : undefined;
      /** Reference to parent stack.  Set in Stack.prototype.{add,insert}(). */
      this.stack = undefined;
      /* map objects persist through being dragged in and out of Stacks. */
      maps[mapName] = this;
    };
    Stacked.prototype.mapName = undefined;
    Stacked.prototype.portion = undefined;
    function positionToString(p)
    {
      return (p === undefined) ? ""
        : "[" + round_2(p[0]) + ", " + round_2(p[1]) + "]";
    }
    Stacked.prototype.toString = function ()
    {
      let a =
        [ "{mapName=", this.mapName, ", portion=" + round_2(this.portion),
          positionToString(this.position) + this.stack.length, "}" ];
      return a.join("");
    };
    Stacked.prototype.log = function ()
    {
      console.log
      ("{mapName=", this.mapName, ", portion=", round_2(this.portion),
       positionToString(this.position), this.stack,  "}");
    };
    Stacked.mapName_match =
      function (mapName)
    { return function (s) { return s.mapName === mapName; };};
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
     * Construct a Stacked containing 1 map (mapName, portion),
     * and push onto this Stack.
     */
    function Stack(stackable) {
      this.stackID = nextStackID++;
      /** The map object (Stacked) has a reference to its parent stack which is the inverse of this reference : 
       * maps{mapName}->stack->maps[i] == maps{mapName} for some i.
       */
      this.maps = [];
      Stack.prototype.add = Stack_add;
      this.add(stackable);
    };
    /**  Wrapper for new Stack() : implement a basic object re-use.
     *
     * The motive is that as a map is dragged through a series of stacks, it is
     * removed from its source stack, inserted into a destination stack, then as
     * cursor drag may continue, removed from that stack, and may finally be
     * moved into a new (empty) stack (dropOut()).  The abandoned empty stacks
     * are not deleted until dragended(), to avoid affecting the x positions of
     * the non-dragged stacks.  These could be collected, but it is simple to
     * re-use them if/when the map is dropped-out.  By this means, there is at
     * most 1 abandoned stack to be deleted at the end of the drag; this is
     * stacks.toDeleteAfterDrag.
     */
    function new_Stack(stackable) {
      let s;
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
    /** undefined, or references to the map (Stacked) which is currently dropped
     * and the Stack which it is dropped into (dropIn) or out of (dropOut).
     * properties :
     * out : true for dropOut(), false for dropIn()
     * stack: the Stack which mapName is dropped into / out of
     * 'mapName': mapName,
     * dropTime : Date.now() when dropOut() / dropIn() is done
     *
     * static
     */
    Stack.prototype.currentDrop = undefined;
    /** undefined, or name of the map which is currently being dragged. */
    Stack.prototype.currentDrag = undefined;
    /** @return true if this.maps[] is empty. */
    Stack.prototype.empty = function ()
    {
      return this.maps.length === 0;
    };
    /** @return array of mapIDs of this Stack */
    Stack.prototype.mapIDs = function ()
    {
      let a =
        this.maps.map(function(s){return s.mapName;});
      return a;
    };
    Stack.prototype.toString = function ()
    {
      let a =
        [
        "{maps=[",
        this.maps.map(function(s){return s.toString();}),
        "] length=" + this.maps.length + "}"
        ];
      return a.join("");
    };
    Stack.prototype.log = function ()
    {
      console.log("{stackID=", this.stackID, ", maps=[");
      this.maps.forEach(function(s){s.log();});
      console.log("] length=", this.maps.length, "}");
    };
    /** Log all stacks. static. */
    stacks.log = 
    Stack.log = function()
    {
      if (trace_stack < 2) return;
      console.log("{stacks=[");
      stacks.forEach(function(s){s.log();});
      console.log("] length=", stacks.length, "}");
    };
    /** Append the given stack to stacks[]. */
    stacks.append = function(stack)
    {
      stacks.push(stack);
    };
    /** Insert the given stack into stacks[] at index i. */
    stacks.insert = function(stack, i)
    {
      stacks = stacks.insertAt(i, stack);
    };
    /** stackID is used as the domain of the X axis. */
    stacks.stackIDs = function()
    {
      let sis = stacks.map(
        function (s) {
          return s.stackID;
        });
      return sis;
    };
    /** Sort the stacks by the x position of their maps. */
    stacks.sortLocation = function()
    {
      stacks.sort(function(a, b) { return a.location() - b.location(); });
    };
    /** Return the x location of this stack.  Used for sorting after drag. */
    Stack.prototype.location = function()
    {
      let l = this.maps[0].location();
      checkIsNumber(l);
      return l;
    };
    /** Find stack of mapID and return the index of that stack within stacks.
     * @param mapID name of map to find
     * @return index of the parent stack of map
     */
    Stack.prototype.stackIndex = function (mapID)
    {
      let map = maps[mapID], s = map.stack, i = stacks.indexOf(s);
      let j;
      if ((i === -1) || (stacks[i] !== s) || (j=s.maps.indexOf(map), s.maps[j].mapName != mapID))
      {
        console.log("stackIndex", mapID, i, map, s, j, s.maps[j]);
        debugger;
      }
      return i;
    };
    Stack.prototype.add = function(stackable)
    {
      this.maps.push(stackable);
      stackable.stack = this;
      maps[stackable.mapName] = stackable;
    };
    Stack.prototype.addMap = function(mapName, portion)
    {
      let sd = new Stacked(mapName, portion);
      this.add(sd);
    };
    /** Method of Stack.  @see Stack.prototype.add().
     * Add the given map to this Stack.
     * @param sd  (stackable) Stacked / map to add
     */
    function Stack_add (sd)
    {
      this.maps.push(sd);
      sd.stack = this;
    };
    /** Insert stacked into maps[] at i, moving i..maps.length up
     * @param i  same as param start of Array.splice()
     * @see {@link https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Array/splice | MDN Array Splice}
     */
    Stack.prototype.insert = function (stacked, i)
    {
      let len = this.maps.length;
      // this is supported via splice, and may be useful later, but initially it
      // would indicate an error.
      if ((i < 0) || (i > len))
        console.log("insert", stacked, i, len);

      this.maps = this.maps.insertAt(i, stacked);
      /* this did not work (in Chrome) : .splice(i, 0, stacked);
       * That is based on :
       * https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Array/splice
       * Similarly in 2 other instances in this file, .removeAt() is used instead of .splice().
       */

      stacked.stack = this;
    };
    /** Find mapName in this.maps[]. */
    Stack.prototype.findIndex = function (mapName)
    {
      let mi = this.maps.findIndex(Stacked.mapName_match(mapName));
      return mi;
    };
    /** Find mapName in this.maps[] and remove it.
     * @return the map, or undefined if not found
     */
    Stack.prototype.remove = function (mapName)
    {
      let si = this.findIndex(mapName);
      if (si < 0)
      {
        console.log("Stack#remove named map not in this stack", this, mapName);
        return undefined;
      }
      else
      {
        let s = this.maps[si];
        this.maps = this.maps.removeAt(si, 1);
          // .splice(si, 1);
        return s;
      }
    };
    /** Remove this Stack from stacks[].
     * @return false if not found, otherwise it is removed
     */
    Stack.prototype.delete = function ()
    {
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
     * Move named map from one stack to another.
     * `this` is the source stack.
     * If first stack becomes empty - delete it.
     * If 2nd stack (destination) is new - create it (gui ? drag outside of top/bottom drop zones.)
     * @param mapName name of map to move
     * @param toStack undefined, or Stack to move map to
     * @param insertIndex  index in toStack.maps[] to insert
     *
     * if toStack is undefined, create a new Stack to move the map into;
     * The position in stacks[] to insert the new Stack is not given via params,
     * instead dragged() assigns x location to new Stack and sorts the stacks in x order.
     *
     * @return undefined if not found, or an array.
     * If `this` is empty after the move, it is deleted, otherwise the result
     * array contains `this`; this is so that the caller can call
     * .calculatePositions().
     */
    Stack.prototype.move = function (mapName, toStack, insertIndex)
    {
      let result = undefined;
      let s = this.remove(mapName);
      // if mapName is not in this.maps[], do nothing
      let ok = s !== undefined;
      if (ok)
      {
        if (toStack === undefined)
        {
          toStack = new_Stack(s);
          /* Need to call .calculatePositions() for this and toStack;
           * That responsibility is left with the caller, except that
           * caller doesn't have toStack, so .move() looks after it.
           * No : map.position and .portion are updated after .move()
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
           * If source stack has only 1 map, then dropOut() deletes the stack
           * and stacks to its right shift left in the array to fill the gap;
           * That causes : destination stack moves to x of source stack when
           * dragging to the right, iff the source stack has only 1 map.
           * That behaviour should occur after dragended, not during.
           */
          stacks.toDeleteAfterDrag = this;
        }
        else
          result.push(this);
        me.send('updatedStacks', stacks);
      }
      return result;
    };
    /** Shift named map to a different position within this Stack.
     * Portions will be unchanged, positions will be re-calculated.
     * Find mapName in this.maps[] and move it.

     * @param mapName name of map to move
     * @param insertIndex  index in toStack.maps[] to insert
     * @return the map, or undefined if not found
     */
    Stack.prototype.shift = function (mapName, insertIndex)
    {
      let si = this.findIndex(mapName);
      if (si < 0)
      {
        console.log("Stack#remove named map not in this stack", this, mapName);
        return undefined;
      }
      else
      {
        let s = this.maps[si];
        console.log("shift(), before removeAt()", this, mapName, insertIndex, this.maps.length, s);
        this.log();
        this.maps = this.maps.removeAt(si, 1);
        let len = this.maps.length;
        this.log();
        if (insertIndex >= len)
          console.log("shift()", this, mapName, insertIndex, " >= ", len, s);
        let insertIndexPos = (insertIndex < 0) ? len + insertIndex : insertIndex;
        // splice() supports insertIndex<0; if we support that, this condition need
        if (si < insertIndexPos)
          insertIndexPos--;
        this.maps = this.maps.insertAt(insertIndexPos, s);
        console.log("shift(), after insertAt()", insertIndexPos, this.maps.length);
        this.log();
        return s;
      }
    };
    /** @return true if this Stack contains mapName
     */
    Stack.prototype.contains = function (mapName)
    {
      return this === maps[mapName].stack;
    };
    /** Insert the named map into this.maps[] at insertIndex (before if top, after
     * if ! top).
     * Preserve the sum of this.maps[*].portion (which is designed to be 1).
     * Give the new map a portion of 1/n, where n == this.maps.length after insertion.
     *
     * share yRange among maps in stack
     * (retain ratio among existing maps in stack)
     *
     * @param mapName name of map to move
     * @param insertIndex position in stack to insert at.
     * @param true for the DropTarget at the top of the axis, false for bottom.
     * @param transition  make changes within this transition
     */
    Stack.prototype.dropIn = function (mapName, insertIndex, top, transition)
    {
      console.log("dropIn", this, mapName, insertIndex, top);
      // can now use  maps[mapName].stack
      let fromStack = Stack.mapStack(mapName);
      /* It is valid to drop a map into the stack it is in, e.g. to re-order the maps.
       * No change to portion, recalc position.
       */
      if (this === fromStack)
      {
        console.log("Stack dropIn() map ", mapName, " is already in this stack");
        this.shift(mapName, insertIndex);
        return;
      }
      /** Any map in the stack should have the same x position; use the first
       * since it must have at least 1. */
      let aMapName = this.maps[0].mapName,
      /** Store both the cursor x and the stack x; the latter is used, and seems
       * to give the right feel. */
      dropX = {event: d3.event.x, stack: o[aMapName]};
      Stack.prototype.currentDrop = {out : false, stack: this, 'mapName': mapName, dropTime : Date.now(), x : dropX};
      if (! top)
        insertIndex++;
      let okStacks =
        fromStack.move(mapName, this, insertIndex);
      // okStacks === undefined means mapName not found in fromStack
      if (okStacks)
      {
        // if fromStack is now empty, it will be deleted, and okStacks will be empty.
        // if fromStack is not deleted, call fromStack.calculatePositions()
        let map = maps[mapName],
        released = map.portion;
        console.log("dropIn", released, okStacks);
        okStacks.forEach(function(s) { 
          s.releasePortion(released);
          s.calculatePositions();
          s.redraw(transition); });

        // For all maps in this (the destination stack), adjust portions, then calculatePositions().
        /** the inserted map */
        let inserted = this.maps[insertIndex];
        inserted.stack = this;
        // apart from the inserted map,
        // reduce this.maps[*].portion by factor (n-1)/n
        let n = this.maps.length,
        factor = (n-1)/n;
        inserted.portion = 1/n;
        this.maps.forEach(
          function (m, index) { if (index !== insertIndex) m.portion *= factor; });
        this.calculatePositions();
      }
    };
    /** Used when a map is dragged out of a Stack.
     * re-allocate portions among remaining maps in stack
     * (retain ratio among existing maps in stack)
     * This is used from both dropIn() and dropOut(), for the Stack which the
     * map is dragged out of.
     * @param released  the portion of the map which is dragged out
     */
    Stack.prototype.releasePortion = function (released)
    {
        let
          factor = 1 / (1-released);
        this.maps.forEach(
          function (m, index) { m.portion *= factor; });
        this.calculatePositions();
    };
    /** Drag the named map out of this Stack.
     * Create a new Stack containing just the map.
     *
     * re-allocate portions among remaining maps in stack
     * (retain ratio among existing maps in stack)
     *
     * .dropIn() and .dropOut() both affect 2 stacks : the map is dragged from
     * one stack (the term 'source' stack is used in comments to refer this) to
     * another (call this the 'destination' stack). .dropOut() may create a new
     * stack for the destination.
     *
     * @param mapName name of map to move
     */
    Stack.prototype.dropOut = function (mapName)
    {
      console.log("dropOut", this, mapName);
      Stack.prototype.currentDrop = {out : true, stack: this, 'mapName': mapName, dropTime : Date.now()};

      /* passing toStack===undefined to signify moving map out into a new Stack,
       * and hence insertIndex is also undefined (not used since map is only map
       * in newly-created Stack).
      */
      let okStacks =
      this.move(mapName, undefined, undefined);
      /* move() will create a new Stack for the map which was moved out, and
       * add that to Stacks.  dragged() will assign it a location and sort.
       */

      // Guard against the case that `this` became  empty and was deleted.
      // That shouldn't happen because dropOut() would not be called if `this` contains only 1 map.
      if (okStacks && (okStacks[0] == this))
      {
        // mapName goes to full height. other maps in the stack take up the released height proportionately
        let map = maps[mapName],
        released = map.portion;
        map.portion = 1;
        this.releasePortion(released);
        let toStack = map.stack;
        toStack.calculatePositions();
      }
    };
    /** Calculate the positions of the maps in this stack
     * Position is a proportion of yRange.
     *
     * Call updateRange() to update ys[mapName] for each map in the stack.
     */
    Stack.prototype.calculatePositions = function ()
    {
      // console.log("calculatePositions", this.stackID, this.maps.length);
      let sumPortion = 0;
      this.maps.forEach(
        function (m, index)
        {
          m.position = [sumPortion,  sumPortion += m.portion];
          updateRange(m);
        });
    };
    /** find / lookup Stack of given map.
     * static
     */
    Stack.mapStack = function (mapName)
    {
      // could use a cached structure such as mapStack[mapName].
      // can now use : maps{mapName}->stack
      let ms = stacks.filter(
        function (s) {
          let i = s.findIndex(mapName);
          return i >= 0;
        });
      if (ms.length != 1)
        console.log("mapStack()", mapName, ms, ms.length);
      return ms[0];
    };
    /** find / lookup Stack of given map.
     * static
     * @return an array (because reduce() doesn't stop at 1)
     * of {stackIndex: number, mapIndex: number}.
     * It will only accumulate the first match (mapIndex) in each stack,
     * but by design there should be just 1 match across all stacks.
     */
    Stack.mapStackIndex = function (mapName)
    {
      /** called by stacks.reduce() */
      function findIndex_mapName
      (accumulator, currentValue, currentIndex /*,array*/)
      {
        let i = currentValue.findIndex(mapName);
        if (i >= 0)
          accumulator.push({stackIndex: currentIndex, mapIndex: i});
        return accumulator;
      };
      let ms = stacks.reduce(findIndex_mapName, []);
      if (ms.length != 1)
      {
        console.log("mapStackIndex()", mapName, ms, ms.length);
      }
      return ms[0];
    };
    /** @return transform : translation, calculated from map position within stack.
     */
    Stacked.prototype.mapTransform = function ()
    {
      if (this.position === undefined || yRange === undefined)
      {
        console.log("mapTransform()", this.mapName, this, yRange);
        debugger;
      }
      let yOffset = this.yOffset(),
      yOffsetText = Number.isNaN(yOffset) ? "" : "," + this.yOffset();
      let scale = this.portion,
      scaleText = Number.isNaN(scale) ? "" : " scale(" + scale + ")";
      /** Will be undefined when map is dragged out to form a new Stack, which
       * is not allocated an x position (via xScale()) until dragended().  */
      let xVal = x(this.mapName);
      if (xVal === undefined)
        xVal = o[this.mapName];
      checkIsNumber(xVal);
      let transform =
        [
          "translate(" + xVal, yOffsetText, ")",
          scaleText
        ].join("");
      console.log("mapTransform", this, transform);
      return transform;
    };
    /** Get stack of map, return transform. */
    Stack.prototype.mapTransform = function (mapName)
    {
      let m = maps[mapName];
      return m.mapTransform();
    };
    /** Get stack of map, return transform. */
    Stack.prototype.mapTransformO = function (mapName)
    {
      let m = maps[mapName];
      return m.mapTransformO();
    };
    /** For each map in this Stack, redraw axis, brush, foreground paths.
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
      /** to make this work, would have to reparent the maps - what's the benefit
      let ts = 
        t.selectAll("g.stack#" + eltId(this.stackID) + " > .map");
       */
      console.log("redraw() stackID:", this.stackID);
      let this_Stack = this;  // only used in trace

      this.maps.forEach(
        function (m, index)
        {
          /** Don't use a transition for the map/axis which is currently being
           * dragged.  Instead the dragged object will closely track the cursor;
           * may later use a slight / short transition to smooth noise in
           * cursor.  */
          let t_ = (Stack.prototype.currentDrag == m.mapName) ? d3 : t;
          // console.log("redraw", Stack.prototype.currentDrag, m.mapName, Stack.prototype.currentDrag == m.mapName);
          let ts = 
            t_.selectAll(".map#" + eltId(m.mapName));
          (trace_stack_redraw > 0) &&
            (((ts._groups.length === 1) && console.log(ts._groups[0], ts._groups[0][0]))
             || ((trace_stack_redraw > 1) && console.log("redraw", this_Stack, m, index, m.mapName)));
          // console.log("redraw", m.mapName);
          // args passed to fn are data, index, group;  `this` is node (SVGGElement)
          ts.attr("transform", Stack.prototype.mapTransformO);
          mapRedrawText(m);
        });

    };

    function mapRedrawText(m)
    {
          let axisTS = svgContainer.selectAll("g.map#" + eltId(m.mapName) + " > text");
          axisTS.attr("transform", yAxisTextScale);
          let axisGS = svgContainer.selectAll("g.axis#" + axisEltId(m.mapName) + " > g.tick > text");
          axisGS.attr("transform", yAxisTicksScale);
          let axisBS = svgContainer.selectAll("g.axis#" + axisEltId(m.mapName) + " > g.btn > text");
          axisBS.attr("transform", yAxisBtnScale);
    }

    /*------------------------------------------------------------------------*/

    /** x scale which maps from mapIDs[] to equidistant points in axisXRange
     */
    //d3 v4 scalePoint replace the rangePoint
    //let x = d3.scaleOrdinal().domain(mapIDs).range([0, w]);
    function xScale() {
      let stackDomain = Array.from(stacks.keys()); // was mapIDs
      console.log("xScale()", stackDomain);
      return d3.scalePoint().domain(stackDomain).range(axisXRange);
    }
    /** scaled x value of each map, indexed by mapIDs */
    let o = {};
    Stacked.prototype.location = function() { return checkIsNumber(o[this.mapName]); };
    /** Same as .mapTransform(), but use o[d] instead of x(d)
     * If this works, then the 2 can be factored.
     * @return transform : translation, calculated from map position within stack.
     */
    Stacked.prototype.mapTransformO = function ()
    {
      if (this.position === undefined || yRange === undefined)
      {
        console.log("mapTransformO()", this.mapName, this, yRange);
        debugger;
      }
      let yOffset = this.yOffset(),
      yOffsetText = Number.isNaN(yOffset) ? "" : "," + this.yOffset();
      /** x scale doesn't matter because x is 0; use 1 for clarity.
       * no need for scale when this.portion === 1
       */
      let scale = this.portion,
      scaleText = Number.isNaN(scale) || (scale === 1) ? "" : " scale(1," + scale + ")";
      let xVal = checkIsNumber(o[this.mapName]);
      let transform =
        [
          " translate(" + xVal, yOffsetText, ")",
          scaleText
        ].join("");
       // console.log("mapTransformO", this, transform);
      return transform;
    };


    let zoomSwitch,resetSwitch;
    let zoomed = false;
    // let reset = false;
    // console.log("zoomSwitch", zoomSwitch);

    let pathMarkers = {}; //For tool tip

    let selectedMaps = [];
    let selectedMarkers = {};
    let brushedRegions = {};

    //Reset the selected Marker region, everytime a map gets deleted
    me.send('updatedSelectedMarkers', selectedMarkers);

    collateData();

    /** For all maps, store the x value of its axis, according to the current scale. */
    function collateO() {
      mapIDs.forEach(function(d){
        o[d] = x(d);
        checkIsNumber(o[d]);
        if (o[d] === undefined) { debugger; console.log(x(d)); }
      });
    }
    mapIDs.forEach(function(d){
      // initial stacking : 1 map per stack, but later when db contains Linkage
      // Groups, can automatically stack maps.
      let sd = new Stacked(d, 1),
      stack = new Stack(sd);
      sd.z = z[d];  // reference from Stacked map to z[mapID]
      stacks.append(stack);
      stack.calculatePositions();
    });
    // xScale() uses stacks.keys().
    let xs = xScale();
    function x(mapID)
    {
      let i = Stack.prototype.stackIndex(mapID);
      if (i === -1) { console.log("x()", mapID, i); debugger; }
      return xs(i);
    }
    collateO();
    //let dynamic = d3.scaleLinear().domain([0,1000]).range([0,1000]);
    //console.log(axis.scale(y[mapIDs))
    collateStacks();
    xDropOutDistance_update();


    /** update ys[m.mapName] for the given map,
     * according the map's current .portion.
     * @param m map (i.e. maps[m.mapName] == m)
     */
    function updateRange(m)
    {
      // if called before ys is set up, do nothing.
      if (ys && ys[m.mapName])
      {
        let myRange = m.yRange();
         console.log("updateRange", m.mapName, m.position, m.portion, myRange);
        ys[m.mapName].range([0, myRange]);
      }
    }


    var path_colour_scale = d3.scaleOrdinal().domain(markers).range(d3.schemeCategory20b);

    mapIDs.forEach(function(d) {
      /** Find the max of locations of all markers of map name d. */
      let yDomainMax = d3.max(Object.keys(z[d]), function(a) { return z[d][a].location; } );
      let m = maps[d], myRange = m.yRange();
      ys[d] = d3.scaleLinear()
               .domain([0, yDomainMax])
               .range([0, myRange]); // set scales for each map
      
      //console.log("OOO " + y[d].domain);
      ys[d].flipped = false;
      // y and ys are the same until the map is stacked.
      // The brush is on y.
      y[d] = ys[d].copy();
      y[d].brush = d3.brushY()
                     .extent([[-8,0],[8,myRange]])
                     .on("end", brushended);
    });

    d3.select("svg").remove();
    d3.select("div.d3-tip").remove();
    let translateTransform = "translate(" + m[marginIndex.left] + "," + m[marginIndex.top] + ")";
    let svgRoot = d3.select('#holder').append('svg')
                         .attr("viewBox", "0 0 " + graphDim.w + " " + graphDim.h)
                         .attr("preserveAspectRatio", "xMinYMin meet")
                         .attr('width', "100%" /*graphDim.w*/)
                         .attr('height', graphDim.h /*"auto"*/);
    let svgContainer = svgRoot
                         .append("svg:g")
                         .attr("transform", translateTransform);

    svgRoot.classed("devel", (markerTotal / mapIDs.length) < 20);

    //User shortcut from the keybroad to manipulate the maps
    d3.select("#holder").on("keydown", function() {
      if ((String.fromCharCode(d3.event.keyCode)) == "D") {
        console.log("Delete Map (not implemented)");
        // deleteMap();
      }
      else if ((String.fromCharCode(d3.event.keyCode)) == "Z") {
        zoomMap();
      }
      else if ((String.fromCharCode(d3.event.keyCode)) == "R") {
        refreshMap();
      }
      else if ((String.fromCharCode(d3.event.keyCode)) == "A") {
        showAll = !showAll;
        console.log("showAll", showAll);
        refreshMap();
      }
      else if ((String.fromCharCode(d3.event.keyCode)) == " ") {
        console.log("space");
      }
    });

    //Add foreground lines.
    foreground = svgContainer.append("g") // foreground has as elements "paths" that correspond to markers
                .attr("class", "foreground")
                .selectAll("g")
                .data(d3Markers) // insert map data into path elements (each line of the "map" is a path)
                .enter()
                .append("g")
                .attr("class", function(d) { return d; });
    
    
    // can use foreground in pathUpdate()
    if (true)
      pathUpdate(undefined);
    else
    d3Markers.forEach(function(m) { 
      d3.selectAll("."+m)
        .selectAll("path")
        .data(path(m))
        .enter()
        .append("path")
        .attr("d", function(d) { return d; });
    });

    // Add a group element for each stack.
    // Stacks contain 1 or more maps.
    /** selection of stacks */
    let stackS = svgContainer.selectAll(".stack")
        .data(stacks)
        .enter().append("g")
        .attr("class", "stack")
        .attr("id", stackEltId);

    function stackEltId(s)
    { if (s.stackID === undefined) debugger;
      return eltId(s.stackID); }

    /** For the given Stack, return its mapIDs  */
    function stack_mapIDs(stack)
    {
      return stack.mapIDs();
    }

    // Add a group element for each map.
    // Stacks are selection groups in the result of this .selectAll()
    let g = stackS.selectAll(".map")
        .data(stack_mapIDs)
        .enter().append("g")
        .attr("class", "map")
        .attr("id", eltId)
        .attr("transform", Stack.prototype.mapTransformO)
        .call(d3.drag()
          .subject(function(d) { return {x: x(d)}; }) //origin replaced by subject
          .on("start", dragstarted) //start instead of dragstart in v4. 
          .on("drag", dragged)
          .on("end", dragended));//function(d) { dragend(d); d3.event.sourceEvent.stopPropagation(); }))

    /*------------------------------------------------------------------------*/
    /** the DropTarget which the cursor is in, recorded via mouseover/out events
     * on the DropTarget-s.  While dragging this is used to know the DropTarget
     * into which the cursor is dragged.
     */
    let currentDropTarget /*= undefined*/;

	  function DropTarget() {
      let size = {
        /** Avoid overlap, assuming about 5-7 stacks. */
      w : Math.min(axisHeaderTextLen, viewPort.w/15),
      // height of dropTarget at the end of an axis
      h : Math.min(80, viewPort.h/10),
      // height of dropTarget covering the adjacent ends of two stacked axes
      h2 : Math.min(80, viewPort.h/10) * 2 /* + axis gap */
      },
	    posn = {
	    X : size.w/2,
      Y : /*YMargin*/10 + size.h
	    },
      /** top and bottom edges relative to the map's transform. bottom depends
       * on the map's portion
       */
      edge = {
        top : size.h,
        bottom : function (map) { return map.yRange() - size.h; }
      };
      /** @return map which this DropTarget is part of */
      DropTarget.prototype.getMap = function ()
      {
        /** The datum of the DropTarget is the mapName */
        let mapName = this.datum(),
        map = maps[mapName];
        return map;
      };
      /// @parameter top  true or false to indicate zone is positioned at top or
      /// bottom of axis
      /// uses g, a selection <g> of all maps
      DropTarget.prototype.add = function (top)
      {
        // Add a target zone for axis stacking drag&drop
        let stackDropTarget = 
          g.append("g")
          .attr("class", "stackDropTarget" + " end " + (top ? "top" : "bottom"));
        let
          dropTargetY = function (datum/*, index, group*/) {
            let mapName = datum,
            map = maps[mapName],
            yVal = top ? -dropTargetYMargin : edge.bottom(map);
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
          let mapName = datum,
          map = maps[mapName];
          return map.yRange() - 2 * size.h;
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

      function storeDropTarget(mapName, classList)
      {
        currentDropTarget = {mapName: mapName, classList: classList};
      }

      function dropTargetMouseOver(data, index, group){
        console.log("dropTargetMouseOver() ", this, data, index, group);
        this.classList.add("dragHover");
        storeDropTarget(data, this.classList);
      }
      function dropTargetMouseOut(d){
        console.log("dropTargetMouseOut", d);
        this.classList.remove("dragHover");
        currentDropTarget = undefined;
      }

    }
    let dropTarget = new DropTarget();

    [true, false].forEach(function (i) {
       dropTarget.add(i);
      // dropTarget.addMiddle(i);
    });



    // Add an axis and title
    g.append("g")
     .attr("class", "axis")
      .each(function(d) { d3.select(this).attr("id",axisEltId(d)).call(axis.scale(y[d])); });  

    function axisTitle(chrID)
    {
      let cn=cmName[chrID];
      // console.log(".axis text", chrID, cn);
      return cn.mapName + " " + cn.chrName;
    }

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("y", -axisFontSize)
      .style("font-size", axisFontSize)
      .text(axisTitle /*String*/);

    /** For <text> within a g.map, counteract the effect of g.map scale() which
     * is based on map.portion.
     *
     * Used for :
     *  g.map > g.axis > g.tick > text
     *  g.map > g.axis > g.btn     (see following yAxisBtnScale() )
     *  g.map > g.axis > text
     * g.axis has the mapName in its name (prefixed via axisEltId()) and in its .__data__.
     * The map / axis title (g.axis > text) has mapName in its name, .__data__, and parent's name
     * (i.e. g[i].__data__ === mapName)
     *
     * g.tick already has a transform, so place the scale transform on g.tick > text.
     * g.btn contains <rect> and <text>, both requiring this scale.
     *
     */
    function yAxisTextScale(/*d, i, g*/)
    {
      let
      mapName = this.__data__,
      map = maps[mapName],
      portion = map && map.portion || 1,
      scaleText = "scale(1, " + 1 / portion + ")";
      // console.log("yAxisTextScale", d, i, g, this, mapName, map, portion, scaleText);
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
    g.append("g")
      .attr("class", "brush")
      .each(function(d) { d3.select(this).call(y[d].brush); });

    //Setup the tool tip.
    let toolTip = d3.select("body").append("div")
                    .attr("class", "toolTip")
                    .attr("id","toolTip")
                    .style("opacity", 0);
    //Probably leave the delete function to Ember
    //function deleteMap(){
    //  console.log("Delete");
    //}


//d3.selectAll(".foreground g").selectAll("path")
    /* (Don, 2017Mar03) my reading of handleMouse{Over,Out}() is that they are
     * intended only for the paths connecting markers in adjacent maps, not
     * e.g. the path in the y axis. So I have narrowed the selector to exclude
     * the axis path.  More exactly, these are the paths to include and exclude,
     * respectively :
     *   svgContainer > g.foreground > g.<markerName> >  path
     *   svgContainer > g.stack > g.map > g.axis#<axisEltId(mapName)> > path    (axisEltId() prepends "m"))
     * (mapName is e.g. 58b504ef5230723e534cd35c_MyChr).
     * This matters because axis path does not have data (observed issue : a
     * call to handleMouseOver() with d===null; reproduced by brushing a region
     * on an axis then moving cursor over that axis).
     */
    d3.selectAll(".foreground > g > path")
      .on("mouseover",handleMouseOver)
      .on("mouseout",handleMouseOut);

    /**
     * @param d   SVG path data string of path
     * @param this  path element
     */
    function handleMouseOver(d){
      //console.log(pathMarkers[d]);
       let t = d3.transition()
                 .duration(800)
                 .ease(d3.easeElastic);
       let listMarkers  = "";
       d3.select(this).transition(t)
          .style("stroke", "#880044")
          .style("stroke-width", "6px")
          .style("stroke-opacity", 1)
          .style("fill", "none");       
       toolTip.style("height","auto")
         .style("width","auto")
         .style("opacity", 0.9)
         .style("display","inline");  
       Object.keys(pathMarkers[d]).map(function(m){
         let hoverExtraText = pathMarkers[d][m];
         if (hoverExtraText === 1) hoverExtraText = "";
         listMarkers = listMarkers + m + hoverExtraText + "<br />";
       });
       toolTip.html(listMarkers)     
         .style("left", (d3.event.pageX) + "px")             
         .style("top", (d3.event.pageY - 28) + "px");
    }

    function handleMouseOut(/*d*/){
      let t = d3.transition()
                .duration(800)
                .ease(d3.easeElastic);
      //Simple solution is to set all styles to null, which will fix the confusion display with brush. Note: tried css class, maybe my way is not right, but it didn't work.
      d3.select(this).transition(t)
           .style("stroke", null)
           .style("stroke-width", null)
           .style("stroke-opacity",null)
           .style("fill", null);
      toolTip.style("display","none");
    }


    function zoomMap(){
      console.log("Zoom : zoomMap()");
    }
    function refreshMap(){
      console.log("Refresh");
    }


    /** Construct a unique name for a group of aliases - sort the aliases and catenate them.
     */
    function aliasesUniqueName(aliases)
    {
      let s = aliases.sort().join("_");
      aliases.name = s;
      return s;
    }
    /** After data is loaded, collate to enable faster lookup in collateStacks() and dragged().
     * for each map
     *   for each marker
     *     store : ref to parent map       .map
     *     store : marker -> array of maps (or set)  markers[marker] : set of maps
     *     store       ag[ag] : [ marker ] marker references map and array of aliases
     *     {unique name of alias group (sort) : array of : map / marker / array of aliases}
     *     for each alias
     *       store map / alias : marker    mam[map][alias group] : marker
     *       store map/marker : alias groups  (or was that alias groups to marker)
     *          mmag[map][marker] : [ag]
     * 
     */
    function collateData()
    {
      d3.keys(z).forEach(function(map) {
        let zm = z[map];
        // console.log("collateData", map, zm);
        if (mam[map] === undefined)
          mam[map] = {};
        if (magm[map] === undefined)
          magm[map] = {};
        if (mmag[map] === undefined)
          mmag[map] = {};
        let mamm = mam[map];
        d3.keys(zm).forEach(function(marker) {
          try
          {
          zm[marker].map = z[map]; // reference from marker to parent map
          // console.log("collateData", map, zm, zm[marker]);
          } catch (exc)
          {
            console.log("collateData", map, zm, zm[marker], exc);
            debugger;
          }
          if (markers[marker] === undefined)
            markers[marker] = new Set();
          markers[marker].add(map);

          let marker_ = zm[marker], mas = marker_.aliases;
          marker_.name = marker;
          if (mas && mas.length)
          {
            let agName = aliasesUniqueName(mas);
            if (ag[agName] === undefined)
              ag[agName] = [];
            ag[agName].push(marker_);

            for (let markerAlias of mas)
            {
              // done above, could be moved here, if still required :
              // zm[a] = {location: marker_.location};

              mamm[markerAlias] = marker_;
            }

            let mmagm = mmag[map];
            if (mmagm[marker] == undefined)
              mmagm[marker] = [];
            mmagm[marker].push(agName);
          }
        });
      });
    }

    /** At time of axis adjacency change, collate data for faster lookup in dragged().
     *
     *   for each pair of adjacent stacks
     *     for each pair of maps in the 2 adjacent stacks (cross product stack1 x stack2)
     *       for each marker in map
     *         lookup that marker in the other map directly
     *           store : marker : map - map    mmN[marker] : [[marker, marker]]
     *         lookup that marker in the other map via inverted aliases
     *           store : alias group : map/marker - map/marker   agmm[ag] : [marker, marker]  markers have refn to parent map
     * 
     */
    function collateStacks()
    {
      mmN = {};
      agmm = {};

      for (let stackIndex=0; stackIndex<stacks.length-1; stackIndex++) {
        let s0 = stacks[stackIndex], s1 = stacks[stackIndex+1],
        mmaps0 = s0.maps,
        mmaps1 = s1.maps;
        // Cross-product of the two adjacent stacks
        for (let m0i=0; m0i < mmaps0.length; m0i++) {
          let m0 = mmaps0[m0i], zm0 = m0.z, m0Name = m0.mapName, mmag0 = mmag[m0Name];
          for (let m1i=0; m1i < mmaps1.length; m1i++) {
            let m1 = mmaps1[m1i], zm1 = m1.z;
            d3.keys(zm0).forEach(function(marker0) {
              let mmm = [marker0, m0, m1, zm0[marker0], zm1[marker0]];
              if (zm1[marker0])
              {
                if (mmN[marker0] === undefined)
                  mmN[marker0] = [];
                mmN[marker0].push(mmm);
              }
              if (mmag0[marker0])
              {
                if (agmm[ag] === undefined)
                  agmm[ag] = [];
                agmm[ag].push(mmm);
              }
              });
            }
        }
      }
    }

    /**
     * compile map of marker -> array of maps
     *  array of { stack{maps...} ... }
     * stacks change, but maps/chromosomes are changed only when page refresh
     */
    function collateMarkerMap()
    {
      console.log("collateMarkerMap()");
      if (mm === undefined)
        mm = {};
      mma || (mma = {});
      for (let map in z)
      {
        for (let marker in z[map])
        {
          // console.log(map, marker);
          if (mm[marker] === undefined)
            mm[marker] = [];
          mm[marker].push(map);
        }
        /* use marker aliases to match makers */
        Object.entries(z[map]).forEach
        (
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
                mma[alias] || (mma[alias] = []);
                mma[alias].push(map);
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

    /** Return an array of maps contain Marker `marker` and are in stack `stackIndex`.
     * @param marker  name of marker
     * @param stackIndex  index into stacks[]
     * @return array of maps
     */
    function markerStackMaps(marker, stackIndex)
    {
      let stack = stacks[stackIndex], ma=concatAndUnique(mma[marker], mm[marker]);
      // console.log("markerStackMaps()", marker, stackIndex, ma);
      let mmaps = ma.filter(function (mapID) {
        let mInS = stack.contains(mapID); return mInS; });
      // console.log(mmaps);
      return mmaps;
    }
    /** A line between a marker's location in adjacent maps.
     * @param k1, k2 indices into mapIDs[]
     * @param d marker name
     */
    function markerLine2(k1, k2, d)
    {
      let mk1 = mapIDs[k1],
          mk2 = mapIDs[k2];
      return line([[o[mk1], markerY(k1, d)],
                   [o[mk2], markerY(k2, d)]]);
    }
    /** Stacks version of markerLine2().
     * A line between a marker's location in maps in adjacent Stacks.
     * @param mk1, mk2 map names, (exist in mapIDs[])
     * @param d marker name
     */
    function markerLineS2(mk1, mk2, d)
    {
      // o[p], the map location,
      return line([[o[mk1], markerY_(mk1, d)],
                   [o[mk2], markerY_(mk2, d)]]);
    }
    /** Similar to @see markerLine().
     * Draw a horizontal notch at the marker location on the axis.
     * Used when showAll and the marker is not in a map of an adjacent Stack.
     * @param mk mapID
     * @param d marker name
     * @param xOffset add&subtract to x value, measured in pixels
     */
    function markerLineS(mk, d, xOffset)
    {
      let mkY = markerY_(mk, d);
      return line([[o[mk]-xOffset, mkY],
                   [o[mk]+xOffset, mkY]]);
    }
    /** Similar to @see markerLine2().
     * @param k index into mapIDs[]
     * @param d marker name
     * @param xOffset add&subtract to x value, measured in pixels
     */
    function markerLine(k, d, xOffset)
    {
      let mk = mapIDs[k],
      mkY = markerY(k, d);
      return line([[o[mk]-xOffset, mkY],
                   [o[mk]+xOffset, mkY]]);
    }
    /**
     * change to use marker alias group as data of path;
     *  for non-aliased markers, data remains as marker - unchanged
     * 
     * when stack adjacency changes (i.e. drop in/out, dragended) :
     * 
     * compile a list, indexed by marker names,
     *   array of
     *     map from / to (optional : stack index from / to)
     * 
     * compile a list, indexed by marker alias group names (catenation of aliased marker names),
     *   marker name
     *   array of
     *     map from / to (optional : stack index from / to)
     * 
     * I think these will use 2 variants of markerStackMaps() : one using mm[] and the other mma[].
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
       *   all maps of those stacks :
       *    all markers of those maps
       */
      for (let stackIndex=0; stackIndex<stacks.length-1; stackIndex++) {
          let mmaps0 = markerStackMaps(d, stackIndex),
          mmaps1 = markerStackMaps(d, stackIndex+1);
          // Cross-product of the two adjacent stacks; just the maps which contain the marker.
          for (let m0i=0; m0i < mmaps0.length; m0i++) {
            let m0 = mmaps0[m0i];
            for (let m1i=0; m1i < mmaps1.length; m1i++) {
              let m1 = mmaps1[m1i];
              if (magm[d] === undefined)
                magm[d] = [];
              magm[d].push([stackIndex, m0, m1]);
            }
          }
        }
    }

    /** This is the stacks equivalent of path() / zoompath().
     * Returns an array of paths (links between maps) for a given marker.
     */
    function path(markerName) {
        let r = [];
      // TODO : discard markers of the paths which change
      // pathMarkers = {};

      /** 1 string per path segment */
      let
      mmNm = mmN[markerName];
      if (mmNm !== undefined)
        /* console.log("path", markerName);
      else */
      if (unique_1_1_mapping && (mmNm.length > 1))
      { /* console.log("path : multiple", markerName, mmNm.length, mmNm); */ }
      else
      for (let i=0; i < mmNm.length; i++)
      {
        let [markerName, m0_, m1_, zm0, zm1] = mmNm[i];
        let m0 = m0_.mapName, m1 = m1_.mapName;
        if ((zm0 !== zm1) && (m0 == m1))
          console.log("path", i, markerName, zm0, zm1, m0, m1);
        r[i] = pathmm(m0, m1, markerName);
      }
      // console.log("path", markerName, mmNm, r);
      return r;
    }

    /** TODO : for paths with alias group as data
     * @param ag   alias group (name)?
     */
    function pathAg(ag) {
      /** 1 string per path segment */
      let p = [],
      agmma = agmm[ag];
      if (agmma === undefined)
        console.log("pathAg", ag);
      else
      for (let i=0; i < agmma.length; i++)
      {
        let [markerName, m0, m1, zm0, zm1] = agmma[i];
        p[i] = pathmm(m0.mapName, m1.mapName, markerName);
      }
      return p.join();
    }

    /**
     * @param  m0, m1  map names
     * @param d marker name
     */
    function pathmm(m0, m1, d) {
      // let [stackIndex, m0, m1] = magm[d];
      let r;

              let range = [0, yRange];
              /** Calculate relative location of marker d in the map mapID, and
               * check if it is inRange 
               */
              function inRangeI(mapID)
              {
                return inRange(markerY_(mapID, d), range);
              };

              /** Filter out those paths that either side locates out of the svg. */
              let lineIn = allowPathsOutsideZoom ||
                (inRangeI(m0) && inRangeI(m1));
              // console.log("path()", stackIndex, m0, allowPathsOutsideZoom, inRangeI(m0), inRangeI(m1), lineIn);
              if (lineIn)
              {
                let sLine = markerLineS2(m0, m1, d);
                /** 1 signifies the normal behaviour - handleMouseOver() will show just the marker name.
                 * Values other than 1 will be appended as text. */
                let hoverExtraText = showHoverExtraText ?
                  " " + z[m0][d].location + "-" + z[m1][d].location + " " + sLine
                  : 1;
                // console.log("stacksPath()", d, m0i, m1i, m0, m1, z[m0][d].location, z[m1][d].location, sLine, this);
                r = sLine;
                /* Prepare a tool-tip for the line. */
                if (pathMarkers[sLine] === undefined)
                  pathMarkers[sLine] = {};
                pathMarkers[sLine][d] = hoverExtraText; // 1;
              }
              else if (showAll) {
                if (d in z[m0]) { 
                  r = markerLineS(m0, d, 5);
                }
                if (d in z[m1]) {
                  r = markerLineS(m1, d, 5);
                }
              }
      return r;
    }
    // Returns an array of paths (links between maps) for a given marker.
    function path_pre_Stacks(d) { // d is a marker
        let r = [];

        for (let k=0; k<mapIDs.length-1; k++) {
          let m_k  = mapIDs[k],
              m_k1 = mapIDs[k+1];
            if (d in z[m_k] && d in z[m_k1]) { // if markers is in both maps
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

    /** Calculate relative marker location in the map.
     * Result Y is relative to the stack, not the map,
     * because .foreground does not have the map transform (maps which are ends
     * of path will have different Y translations).
     *
     * @param mapID name of map  (exists in mapIDs[])
     * @param d marker name
     */
    function markerY_(mapID, d)
    {
      // z[p][m].location, actual position of marker m in the map p, 
      // y[p](z[p][m].location) is the relative marker position in the svg
      // ys is used - the y scale for the stacked position&portion of the map.
      let ysm = ys[mapID],
      mky = ysm(z[mapID][d].location),
      mapY = maps[mapID].yOffset();
      if (! tracedMapScale[mapID])
      {
        tracedMapScale[mapID] = true;
        /* let yDomain = ysm.domain();
         console.log("markerY_", mapID, d, z[mapID][d].location, mky, mapY, yDomain, ysm.range()); */
      }
      return mky + mapY;
    }
    /** Calculate relative marker location in the map
     * @param k index into mapIDs[]
     * @param d marker name
     */
    function markerY(k, d)
    {
      return markerY_(mapIDs[k], d);
    }


    // Returns an array of paths (links between maps) for a given marker when zoom in starts.
    function zoomPath(d) { // d is a marker
        let r = [];
        for (let k=0; k<mapIDs.length-1; k++) {
           //ys[p].domain
           //z[mapIDs[k]][d].location marker location

            if (d in z[mapIDs[k]] && d in z[mapIDs[k+1]]) { // if markers is in both maps
              /** relative marker location in the map of 2 markers, k and k+1 :
               * k  : markerYk[0]
               * k+1: markerYk[1]
               */
              let markerYk = [markerY(k, d), markerY(k+1, d)];
              // Filter out those paths that either side locates out of the svg
              if (inRange(markerYk[0], [0, yRange]) &&
                  inRange(markerYk[1], [0, yRange])) {
                        let sLine = line([[o[mapIDs[k]], markerYk[0]],
                             [o[mapIDs[k+1]], markerYk[1]]]);
                        if(pathMarkers[sLine] != null){
                          pathMarkers[sLine][d] = 1;
                        } else {
                          pathMarkers[sLine]= {};
                          pathMarkers[sLine][d] = 1;
                        }
                        r.push(line([[o[mapIDs[k]], markerYk[0]],
                             [o[mapIDs[k+1]], markerYk[1]]]));
                  } 
              
            } 
        }
        return r;
    }

    /** Used when the user completes a brush action on the map axis.
     * The datum of g.brush is the ID/name of its map, call this mapID.
     * If null selection then remove mapID from selectedMaps[], otherwise add it.
     * Update selectedMarkers{}, brushedRegions{} : if selectedMaps[] is empty, clear them.
     * Otherwise, set brushedRegions[mapID] to the current selection (i.e. of the brush).
     * Set brushExtents[] to the brushedRegions[] of the maps in selectedMaps[].
     * For each map in selectedMaps[], clear selectedMarkers{} then store in it the
     * names + locations of markers which are within the brush extent of the map.
     * Add circle.mapID for those marker locations.
     * Remove circles of markers (on all maps) outside brushExtents[mapID].
     * For elements in '.foreground g', set class .faded iff the marker (which
     * is the datum of the element) is not in the selectedMarkers[] of any map.
     *
     * Draw buttons to zoom to the brushExtents (zoomSwitch) or discard the brush : resetSwitch.
     * Called from brushended(), which is called on(end) of axis brush.
     *
     * @param that  the brush g element.
     * The datum of `that` is the name/ID of the map which owns the brushed axis.
     * 
     */
    function brushHelper(that) {
      //Map name, e.g. 32-1B
      /** name[0] is mapID of the brushed axis. name.length should be 1. */
      let name = d3.select(that).data();

      //Remove old circles.
      svgContainer.selectAll("circle").remove();

      if (d3.event.selection == null) {
        selectedMaps.removeObject(name[0]);
      }
      else {
        selectedMaps.addObject(name[0]); 
      }

      // selectedMaps is an array containing the IDs of the maps that
      // have been selected.
      
      if (selectedMaps.length > 0) {
        console.log("Selected: ", " ", selectedMaps.length);
        // Maps have been selected - now work out selected markers.
        brushedRegions[name[0]] = d3.event.selection;
        brushExtents = selectedMaps.map(function(p) { return brushedRegions[p]; }); // extents of active brushes

        selectedMarkers = {};
        selectedMaps.forEach(function(p, i) {
          /** d3 selection of one of the selected maps. */
          let mappS = svgContainer.selectAll("#" + eltId(p));
          selectedMarkers[p] = [];
          d3.keys(z[p]).forEach(function(m) {

          let yp = y[p],
          map = maps[p],
          brushedDomain = brushExtents[i].map(function(ypx) { return yp.invert(ypx /* *map.portion */); });
          //console.log("brushHelper", name, p, yp.domain(), yp.range(), brushExtents[i], map.portion, brushedDomain);

            if ((z[p][m].location >= brushedDomain[0]) &&
                (z[p][m].location <= brushedDomain[1])) {
              //selectedMarkers[p].push(m);    
              selectedMarkers[p].push(m + " " + z[p][m].location);
              //Highlight the markers in the brushed regions
              //o[p], the map location, z[p][m].location, actual marker position in the map, 
              //y[p](z[p][m].location) is the relative marker position in the svg
              let dot = mappS
                .append("circle")
                                    .attr("class", m)
                                    .attr("cx",0)   /* was o[p], but g.map translation does x offset of stack.  */
                                    .attr("cy",y[p](z[p][m].location))
                                    .attr("r",2)
                                    .style("fill", "red");

        
            } else {
              mappS.selectAll("circle." + m).remove();
            }
          });
        });
        me.send('updatedSelectedMarkers', selectedMarkers);

        d3.selectAll(".foreground g").classed("faded", function(d){
         //d3.event.selection [min,min] or [max,max] should consider as non selection.
         //maybe alternatively use brush.clear or (brush.move, null) given a mouse event
          // discuss : d3.keys(selectedMarkers). seems equivalent to selectedMaps.
          /// also this could be .some() instead of ! .every():
          return ! selectedMaps.some(function(p) {
            /** d is markerName, p is mapName. */
            let smp = selectedMarkers[p];
            // ma_ is e.g. "markerD 0.4".
            return smp.some(function(ma_) { return ma_.includes(d+" "); });
          });
          // not used
          return !d3.keys(selectedMarkers).every(function(p) {
            /** return true if some of the selectedMarkers of mapID p contain marker d.  */
            let smp = selectedMarkers[p];
            // following seems equivalent to :
            if (false) { return smp.some(function(ma_) { return ma_.includes(d+" "); }); }

            //Maybe there is a better way to do the checking. 
            //d is the marker name, where smp[ma] contains marker name and postion, separated by " "
            for (var ma=0; ma<smp.length; ma++){
              if (smp[ma].includes(d+" ")){
                 return true;
              }
            }
            return false;
            //return smp.contains(d);
          });
        
        });

        svgContainer.selectAll(".btn").remove();
        /** d3 selection of the brushed map. */
        let mapS = svgContainer.selectAll("#" + eltId(name[0]));
          zoomSwitch = mapS
                  .append('g')
                  .attr('class', 'btn')
                  .attr('transform', yAxisBtnScale);
        zoomSwitch.append('rect')
                  .attr('width', 60).attr('height', 30)
                  .attr('rx', 3).attr('ry', 3)
                  .attr('fill', '#eee').attr('stroke', '#ddd');
        zoomSwitch.append('text')
                  .attr('x', 30).attr('y', 20).attr('text-anchor', 'middle')
                  .text('Zoom');
        
        zoomSwitch.on('click', function () {
           zoom(that,brushExtents);
           zoomed = true;

           //reset function
           svgContainer.selectAll(".btn").remove();
           //Remove all the existing circles
           svgContainer.selectAll("circle").remove();
            resetSwitch = mapS
                                    .append('g')
                                    .attr('class', 'btn')
                                    .attr('transform', yAxisBtnScale);
           resetSwitch.append('rect')
                  .attr('width', 60).attr('height', 30)
                  .attr('rx', 3).attr('ry', 3)
                  .attr('fill', '#eee').attr('stroke', '#ddd');
           resetSwitch.append('text')
                      .attr('x', 30).attr('y', 20).attr('text-anchor', 'middle')
                      .text('Reset');

           resetSwitch.on('click',function(){
             let t = svgContainer.transition().duration(750);
             
             mapIDs.forEach(function(d) {
               let idName = axisEltId(d); // axis ids have "m" prefix
               let yDomainMax = d3.max(Object.keys(z[d]), function(a) { return z[d][a].location; } );
               y[d].domain([0, yDomainMax]);
               ys[d].domain([0, yDomainMax]);
               let yAxis = d3.axisLeft(y[d]).ticks(10);
               svgContainer.select("#"+idName).transition(t).call(yAxis);
             });
             let axisTickS = svgContainer.selectAll("g.axis > g.tick > text");
             axisTickS.attr("transform", yAxisTicksScale);

             pathUpdate(t);
             mapS.selectAll(".btn").remove();
             selectedMarkers = {};
             me.send('updatedSelectedMarkers', selectedMarkers);
             zoomed = false;
           });
        });
        
      } else {
        // No axis selected so reset fading of paths or circles.
        svgContainer.selectAll(".btn").remove();
        svgContainer.selectAll("circle").remove();
        d3.selectAll(".foreground g").classed("faded", false);
        selectedMarkers = {};
        me.send('updatedSelectedMarkers', selectedMarkers);
        brushedRegions = {};
      }

    } // brushHelper

    /** Zoom the y axis of this map to the given brushExtents[].
     * Called via on(click) of brushHelper() Zoom button (zoomSwitch).
     * Traverse selected maps, matching only the mapName of the brushed map.
     * Set the y domain of the map, from the inverse mapping of the brush extent limits.
     * Remove the zoom button, redraw the axis, ticks, zoomPath. Move the brush.
     * @param that  the brush g element.
     * The datum of `that` is the name of the map which owns the brushed axis.
     * @param brushExtents  limits of the current brush, to which we are zooming
     */
    function zoom(that, brushExtents) {
      let mapName = d3.select(that).data();
      let t = svgContainer.transition().duration(750);
      selectedMaps.map(function(p, i) {
        if(p == mapName){
          let yp = y[p],
          map = maps[p],
          brushedDomain = brushExtents[i].map(function(ypx) { return yp.invert(ypx /* *map.portion*/); });
          // brushedDomain = [yp.invert(brushExtents[i][0]), yp.invert(brushExtents[i][1])];
          console.log("zoom", mapName, p, i, yp.domain(), yp.range(), brushExtents[i], map.portion, brushedDomain);
          y[p].domain(brushedDomain);
          ys[p].domain(brushedDomain);
          let yAxis = d3.axisLeft(y[p]).ticks(axisTicks * map.portion);
          let idName = axisEltId(p);
          svgContainer.selectAll(".btn").remove();
          svgContainer.select("#"+idName).transition(t).call(yAxis);
          pathUpdate(t);
          // `that` refers to the brush g element
          d3.select(that).call(y[p].brush.move,null);
          let axisGS = svgContainer.selectAll("g.axis#" + axisEltId(p) + " > g.tick > text");
          axisGS.attr("transform", yAxisTicksScale);
        }
      });
    }

    function brushended() {
      //console.log("brush event ended");
      brushHelper(this);
    }


    function dragstarted(start_d /*, start_index, start_group*/) {
      Stack.prototype.currentDrop = undefined;
      Stack.prototype.currentDrag = start_d;
      unique_1_1_mapping = me.get('isShowUnique');
      use_path_colour_scale = me.get('pathColourScale');
      console.log("dragstarted", this, start_d/*, start_index, start_group*/);
      let cl = {/*self: this,*/ d: start_d/*, index: start_index, group: start_group, mapIDs: mapIDs*/};
      svgContainer.classed("axisDrag", true);
      d3.select(this).classed("active", true);
      d3.event.subject.fx = d3.event.subject.x;
      /* Assign class current to dropTarget-s depending on their relation to drag subject.
       add class 'current' to indicate which zones to get .dragHover
       axis being dragged does not get .current
       middle targets on side towards dragged axis don't
       axes i in 1..n,  dragged axis : dg
       current if dg != i && (! middle || ((side == left) == (i < dg)))
       * for (i < dg), use x(d) < startx
       */
      g.selectAll('g.map > g.stackDropTarget').classed
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
         // console.log("current classed", this, d3.event, d, index, group, cl, xd, startX, middle, left, isCurrent);
         return isCurrent;
       });
    }

    /** @param  d (datum) name of map being dragged.
     */
    function dragged(d) {
      /** Transition created to manage any changes. */
      let t;
      /** X distance from start of drag */
      let xDistance;
      if (dragging++ > 0) { console.log("dragged drop"); return;}
      if (! svgContainer.classed("dragTransition"))
      {
        // if cursor is in top or bottom dropTarget-s, stack the map,
        // otherwise set map x to cursor x, and sort.
        let dropTargetEnd = currentDropTarget && currentDropTarget.classList.contains("end");

        const dropDelaySeconds = 0.5, milli = 1000;
        /** currentDrop references the mapName being dragged and the stack it is dropped into or out of. */
        let currentDrop = Stack.prototype.currentDrop,
        /** Use the start of the drag, or the most  */
        xDistanceRef = (currentDrop && currentDrop.x) ? currentDrop.x.stack : d3.event.subject.fx,
        now = Date.now();
        // console.log("dragged xDistanceRef", d3.event.x, currentDrop && currentDrop.x, xDistanceRef);
        // console.log("dragged", currentDrop, d);
        /** true iff currentDrop is recent */
        let recentDrop = currentDrop && (now - currentDrop.dropTime < dropDelaySeconds * milli);

        if (false && recentDrop && dropTargetEnd)
        {
          console.log("dragged", currentDrop, currentDropTarget, now - currentDrop.dropTime);
        }
        if (! recentDrop)
        {
          if (dropTargetEnd)
          {
            let targetMapName = currentDropTarget.mapName,
            top = currentDropTarget.classList.contains("top"),
            zoneParent = Stack.mapStackIndex(targetMapName);
            /** destination stack */
            let stack = stacks[zoneParent.stackIndex];
            if (! stack.contains(d))
            {
              t = dragTransitionNew();
              /*  .dropIn() and .dropOut() don't redraw the stacks they affect (source and destination), that is done here,
               * with this exception : .dropIn() redraws the source stack of the map.
               */
              stack.dropIn(d, zoneParent.mapIndex, top, t);
              // mapChangeGroupElt(d, t);
              collateStacks();
              // number of stacks has decreased - not essential to recalc the domain.
              Stack.log();
              stack.redraw(t);
            }
            // set x of dropped mapID
          }
          // For the case : drag ended in a middle zone (or outside any DropTarget zone)
          // else if d is in a >1 stack then remove it else move the stack
          else if ((! currentDrop || !currentDrop.out)
                   && ((xDistance = Math.abs(d3.event.x - xDistanceRef)) > xDropOutDistance))
          {
            /** dragged map, source stack */
            let map = maps[d], stack = map.stack;
            if (currentDrop && currentDrop.stack !== stack)
            {
              console.log("dragged", d, currentDrop.stack, stack);
            }
            if (stack.maps.length > 1)
            {
              t = dragTransitionNew();
              stack.dropOut(d);
              Stack.log();
              // mapChangeGroupElt(d, t);
              collateStacks();
              /* if d is not in currentDrop.stack (=== stack), which would be a
               * program error, dropOut() could return false; in that case stack
               * redraw() may have no effect.
               */
              stack.redraw(t);
              /* if map is dropped out to a new stack, redraw now for
               * continuity, instead of waiting until dragended().
               */
              mapRedrawText(maps[d]);
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
        // console.log("dragged o[d]", o[d], d3.event.x);
        o[d] = d3.event.x;
        // Now impose boundaries on the x-range you can drag.
        // The boundary values are in dragLimit, defined previously.
        if (o[d] < dragLimit.min) { o[d] = dragLimit.min; }
        else if (o[d] > dragLimit.max) { o[d] = dragLimit.max; }
      }
      //console.log(mapIDs + " " + o[d]);
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

      dragging--;
    }

    /** Redraw the map/axis which is being dragged.
     * Calls pathUpdate() which will mostly change the paths connected to the dragged axis;
     * but when dropIn/dropOut(), paths to other axes can be changed when stacking / adjacencies change.
     *
     * @param mapElt  node/DOM element corresponding of map. this of dragged()
     * @param d mapName
     * @param t transition in which to make changes
     */
    function draggedAxisRedraw(mapElt, d, t)
    {
        let st0 = d3.select(mapElt);
        if (! st0.empty())
        {
          /* if (t === undefined)
            t = dragTransitionNew(); */
          // console.log("st0", st0._groups[0].length, st0._groups[0][0]);
          let st = st0; //.transition();  // t
          // st.ease(d3.easeQuadOut);
          // st.duration(dragTransitionTime);
          st.attr("transform", Stack.prototype.mapTransformO);
          // zoomed effects transform via path() : mapTransform.
          pathUpdate(t /*st*/);
          //Do we need to keep the brushed region when we drag the map? probably not.
          //The highlighted markers together with the brushed regions will be removed once the dragging triggered.
          st0.select(".brush").call(y[d].brush.move,null);
          //Remove all highlighted Markers.
          svgContainer.selectAll("circle").remove();
        }
      }

    /** Called when mapID has been dragged from one stack to another.
     * It is expected that the group element of the map, g.map#<eltId(mapID)>,
     * needs to be moved from the source g.stack to destination.
     * @param mapID name/id of map
     * @param t drag transition
     */
    function mapChangeGroupElt(mapID, t)
    {
      let ms_ = "g.map#" + eltId(mapID),
      ms = t.selectAll(ms_),
      gStack = ms._groups[0][0].parentNode;
      // let p = t.select(function() { return gStack; });
      // console.log("mapChangeGroupElt", mapID, t, ms_, ms, p);
      // compare with map->stack
      let map = maps[mapID],
      stackID = map.stack && map.stack.stackID,
      /** destination Stack selection */
      dStack_ = "g.stack#" + stackEltId(map.stack),
      dStackS = t.selectAll(dStack_),
      dStack = dStackS._groups[0][0], // equiv : .node()
      differentStack = gStack !== dStack;
      console.log("mapChangeGroupElt", map, stackID, dStack_, dStackS, dStack, differentStack);

      // not currently used - g.stack layer may be discarded.
      if (false && differentStack)
      {
        var removedGmap = ms.remove(),
        removedGmapNode = removedGmap.node();
        console.log("removedGmap", removedGmap, removedGmapNode);
        let dStackN = dStackS.node();
        // tried .append, .appendChild(), not working yet.
        if (dStackN && dStackN.append)
          //  dStackN.append(removedGmapNode);
          dStackN.append(function() { return removedGmapNode;});
      }
    }

    /** Update the paths connecting markers present in adjacent stacks.
     * @param t undefined, or a d3 transition in which to perform the update.
     */
    function pathUpdate(t)
    {
      // console.log("pathUpdate");
      tracedMapScale = {};  // re-enable trace
      let g = d3.selectAll(".foreground g"),
      gd = g.selectAll("path").data(path);
      gd.exit().remove();
      gd.enter().append("path");
      if (t === undefined) {t = d3; }
      t.selectAll(".foreground path").attr("d", function(d) { return d; });
      d3.selectAll(".foreground > g > path")
        .on("mouseover",handleMouseOver)
        .on("mouseout",handleMouseOut);

      if (use_path_colour_scale)
      gd.style('stroke', function(d) {
        /** d is path SVG line text */
        let markerName = this.parentElement.__data__;
        return path_colour_scale(markerName);
      });

    }

    function dragended(/*d*/) {
      console.log("dragended", stacks.toDeleteAfterDrag);

      if (stacks.toDeleteAfterDrag !== undefined)
      {
        stacks.toDeleteAfterDrag.delete();
        stacks.toDeleteAfterDrag = undefined;
      }

      // in the case of dropOut(),
      // number of stacks has increased - need to recalc the domain, so that
      // x is defined for this map.
      //
      // Order of mapIDs may have changed so need to redefine x and o.
      xs = xScale();
      // if caching, recalc : collateMapPositions();
      
      stacks.sortLocation();
      collateO();
      collateStacks();
      // already done in xScale()
      // x.domain(mapIDs).range(axisXRange);
      let t = d3.transition().duration(dragTransitionTime);
      t.selectAll(".map").attr("transform", Stack.prototype.mapTransformO);
      pathUpdate(t);
      d3.select(this).classed("active", false);
      svgContainer.classed("axisDrag", false);
      d3.event.subject.fx = null;
      Stack.prototype.currentDrag = undefined;
      /** This could be updated during a drag, whenever dropIn/Out(), but it is
       * not critical.  */
      xDropOutDistance_update();


      if (svgContainer.classed("dragTransition"))
      {
        console.log("dragended() dragTransition, end");
        dragTransition(false);
      }
    }
    

  /*function click(d) {
     if (y[d].flipped) {
         y[d] = d3.scale.linear()
              .domain([0,d3.max(Object.keys(z[d]), function(x) { return z[d][x].location; } )])
              .range([0, yRange]); // set scales for each map
          y[d].flipped = false;
          var t = d3.transition().duration(500);
          t.selectAll("#"+d).select(".axis")
            .attr("class", "axis")
            .each(function(d) { d3.select(this).call(axis.scale(y[d])); })
      }
      else {
          y[d] = d3.scale.linear()
              .domain([0,d3.max(Object.keys(z[d]), function(x) { return z[d][x].location; } )])
              .range([yRange, 0]); // set scales for each map
          y[d].flipped = true;
          var t = d3.transition().duration(500);
          t.selectAll("#"+d).select(".axis")
            .attr("class", "axis")
            .each(function(d) { d3.select(this).call(axis.scale(y[d])); })
      }
      y[d].brush = d3.svg.brush()
          .y(y[d])
          .on("brush", brush);
      d3.selectAll(".foreground g").selectAll("path").data(path).enter().append("path");
      var t = d3.transition().duration(500);
      t.selectAll(".foreground path").attr("d", function(d) { return d; });
  }
       let zoomedMarkers = [];

    //console.log(myMaps.start + " " + myMaps.end);
    //d3.select('#grid')
      //.datum(d3Data)
      //.call(grid);
     function refresh() {
    d3.selectAll(".foreground g").selectAll("path").remove();
    d3.selectAll(".foreground g").selectAll("path").data(path).enter().append("path");
    foreground.selectAll("path").attr("d", function(d) { return d; })
  }
*/
  },

  didInsertElement() {
  },

  didRender() {
    // Called on re-render (eg: add another map) so should call
    // draw each time.
    //
    let data = this.get('data');
    this.draw(data);
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
