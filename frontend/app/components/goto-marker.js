import Ember from 'ember';

function EventedListener(evented, methods)
{
  this.evented = evented;
  this.methods = methods;
}
EventedListener.prototype.listen = function(listen)
{
  // based on drawActionsListen()
    console.log("EventedListener listen()", listen, this);
    {
      let onOff = listen ? this.evented.on : this.evented.off,
      me = this;
      this.methods.map(function (m) {
        onOff.apply(me.evented, [m.name, m.target, m.method]);
      });
      /*
        if (listen)
          this.evented.on(name, target, method);
        else
          this.evented.off(name, target, method);
       */
      }
};


export default Ember.Component.extend({

  store: Ember.inject.service('store'),

  /*--------------------------------------------------------------------------*/

  // the life cycle functionality is based on draw-controls, may factor out.
  didInsertElement() {
    console.log("components/goto-marker didInsertElement()", this.drawActions);
    Ember.run.later(function() {
      let d = Ember.$('.tooltip.ember-popover');  // make-ui-draggable
    });
    if (this.drawActions)
    this.drawActions.trigger("gotoMarkerLife", true);
  },
  willDestroyElement() {
    console.log("components/goto-marker willDestroyElement()");
    if (this.drawActions)
    this.drawActions.trigger("gotoMarkerLife", false);
  },
  didRender() {
  },

  createListener() {
    /** drawActions is an action&event bus specific to one draw-map; it is a reference
     * to mapview (see map-view.hbs) but could be owned by the draw-map. */
    let drawActions = this.get('drawActions'); 
    if (drawActions === undefined)
      console.log('parent component drawActions not passed', this);
    else
      this.set('listener', new EventedListener(
        drawActions,
        [{name: 'drawObjectAttributes', target: this, method: this.drawObjectAttributes}]
      ));
  },

  listen: function() {
    // if oa is not passed in as data then listen for it.
    if (this.get('data') === undefined)
    {
      this.createListener();
      if (this.listener)
        this.listener.listen(true);
    }
  }.on('init'),

  cleanup: function() {
    if (this.listener)
      this.listener.listen(false);
  }.on('willDestroyElement'),

  drawObjectAttributes : function(oa)
  {
    /** this is used if goto-marker is instantiated in mapview.hbs (comment in draw-map.js); may drop this  */
    this.set('oa', oa);
    console.log("goto-marker drawObjectAttributes()", this.drawActions, this.drawActions.get('oa'));
  },


  actions : {
    gotoMap() {
      console.log("goto-marker: gotoMap");
    },
    gotoApollo() {
      console.log("goto-marker: gotoApollo");
    }
  },
  /*----------------------------------------------------------------------------
gene/markerHover
intervalHover
locationClick

hover on brush on axis : d3-tip menu : apollo
hover on gene/marker circle in brush on axis : d3-tip menu : Map / Apollo / endPoint
(set endPoint Limit)
click in marker column of spreadsheet : ditto
+ hover on path, click/+hover on marker or alias name : ditto

Map : pull-down list of Map (URLs)
Apollo : link; new window or re-use, later axis-iframe.
------------------------------------------------------------------------------*/


  /* split these out e.g. to models/chromosome, and objectSet() to utils */

  /** @return array of names of chromosomes containing marker */
  markerChrs : function(markerName)
  {
    let c, oa = this.get('data') || this.get('oa');
    // markerAPs may not have been initialised ?
    if (oa && oa.markerAPs && oa.markerAPs[markerName])
      // markerAPs is a hash of Sets
      c = Array.from(oa.markerAPs[markerName].keys());
    else
      c = [];
    return c;
  },
  /** Lookup the given map name in the current store.   Uses peek not find - does
   * not load from back-end.
   * @return map object refn, or undefined if not found
   */
  name2Map : function(store, mapName)
  {
    let
      maps=store
      .peekAll('geneticmap')
      .filter(function (a) { return a.get('name') == mapName;}),
    /** expect a.length == 1  */
    map = maps.length > 0 ? maps[0] : undefined;
    return map;
  },
  /** @return map containing named chromosome */
  chrMap : function(chrName)
  {
    let oa = this.get('data') || this.get('oa'),
    chr = oa && oa.chrPromises[chrName], map;
    if (chr)
      map = chr.content.map;
    else
    {
      let stacked = oa.aps[chrName], store = this.get('store');
      if (stacked === undefined)
        debugger;
      else
      /* Convert map name to object refn, for uniform result object type,
       * because other branch returns map object refn .
       */
      map  =  this.name2Map(store, stacked.mapName);
      console.log("goto-marker chrMap()", oa, oa.chrPromises, chrName, stacked, map);
    }
    return map;
  },

  /*----------------------------------------------------------------------------*/

  /** Convert the given array of object references into a Set,
   * thereby determining the unique references.
   * The caller may convert back to an array, with Array.from(result.keys())
  */
  objectSet : function(objArray)
  {
    function reduce_addToSet(accumulator, currentValue/*, currentIndex, array*/)
    {
      return accumulator.add(currentValue);
    }
    let s = objArray.reduce(reduce_addToSet, new Set());
    return s;
  },

  /*----------------------------------------------------------------------------*/

  mapsOfMarker : Ember.computed('marker1', 'data', 'oa', function (newValue) {
    console.log("mapsOfMarker", newValue);
    let oa = this.get('data') || this.get('oa'),
    chrNames;    
    if (oa)
    {
      let markerName = this.get('marker1');
      chrNames = this.markerChrs.apply(this, [markerName]);
      // console.log(markerName, "chrNames", chrNames);
    }
    else
    {
      return [];  // because oa is needed by markerChrs() and chrMap()
    }
    let
      me = this,
    apsP = chrNames.map(function (chrName) {
      let map = me.chrMap.apply(me, [chrName]);
      return map;
    }),
    uniqueAps = this.objectSet(apsP),
    aps = Array.from(uniqueAps.keys());
    console.log("mapsOfMarker", this.get('marker1'), chrNames, apsP, uniqueAps, aps);
    return aps;
  })

/*----------------------------------------------------------------------------*/

});
