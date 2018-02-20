import Ember from 'ember';

import { EventedListener } from '../utils/eventedListener';


export default Ember.Component.extend({

  store: Ember.inject.service('store'),

  /*--------------------------------------------------------------------------*/

  // the life cycle functionality is based on draw-controls, may factor out.
  didInsertElement() {
    console.log("components/goto-feature didInsertElement()", this.drawActions);
    Ember.run.later(function() {
      let d = Ember.$('.tooltip.ember-popover');  // make-ui-draggable
    });
    if (this.drawActions)
    this.drawActions.trigger("gotoFeatureLife", true);
  },
  willDestroyElement() {
    console.log("components/goto-feature willDestroyElement()");
    if (this.drawActions)
    this.drawActions.trigger("gotoFeatureLife", false);
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
      if (this.listener === undefined)
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
    /** this is used if goto-feature is instantiated in mapview.hbs (comment in draw-map.js); may drop this  */
    this.set('oa', oa);
    console.log("goto-feature drawObjectAttributes()", this.drawActions, this.drawActions.get('oa'));
  },


  actions : {
    gotoMap() {
      console.log("goto-feature: gotoMap");
    },
    gotoApollo() {
      console.log("goto-feature: gotoApollo");
    }
  },
  /*----------------------------------------------------------------------------
gene/featureHover
intervalHover
locationClick

hover on brush on axis : d3-tip menu : apollo
hover on gene/feature circle in brush on axis : d3-tip menu : Map / Apollo / endPoint
(set endPoint Limit)
click in feature column of spreadsheet : ditto
+ hover on path, click/+hover on feature or alias name : ditto

Map : pull-down list of Map (URLs)
Apollo : link; new window or re-use, later axis-iframe.
------------------------------------------------------------------------------*/


  /* split these out e.g. to models/chromosome, and objectSet() to utils */

  /** @return array of names of chromosomes containing feature */
  featureChrs : function(featureName)
  {
    let c, oa = this.get('data') || this.get('oa');
    // featureAxisSets may not have been initialised ?
    if (oa && oa.featureAxisSets && oa.featureAxisSets[featureName])
      // featureAxisSets is a hash of Sets
      c = Array.from(oa.featureAxisSets[featureName].keys());
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
      let stacked = oa.axes[chrName], store = this.get('store');
      if (stacked === undefined)
        debugger;
      else
      /* Convert map name to object refn, for uniform result object type,
       * because other branch returns map object refn .
       */
      map  =  this.name2Map(store, stacked.mapName);
      console.log("goto-feature chrMap()", oa, oa.chrPromises, chrName, stacked, map);
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

  mapsOfFeature : Ember.computed('feature1', 'data', 'oa', function (newValue) {
    console.log("mapsOfFeature", newValue);
    let oa = this.get('data') || this.get('oa'),
    chrNames;    
    let featureName = this.get('feature1');
    if (oa && featureName)
    {
      chrNames = this.featureChrs.apply(this, [featureName]);
      // console.log(featureName, "chrNames", chrNames);
    }
    else
    {
      return [];  // because oa is needed by featureChrs() and chrMap()
    }
    let
      me = this,
    axesParents = chrNames.map(function (chrName) {
      let map = me.chrMap.apply(me, [chrName]);
      return map;
    }),
    uniqueAxes = this.objectSet(axesParents),
    axes = Array.from(uniqueAxes.keys());
    console.log("mapsOfFeature", this.get('feature1'), chrNames, axesParents, uniqueAxes, axes);
    return axes;
  })

/*----------------------------------------------------------------------------*/

});
