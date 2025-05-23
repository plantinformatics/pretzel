import { on } from '@ember/object/evented';
import { computed } from '@ember/object';
import $ from 'jquery';
import { later } from '@ember/runloop';
import { inject as service } from '@ember/service';
import Component from '@ember/component';

import { EventedListener } from '../utils/eventedListener';
import {
  featureChrs,
  name2Map,
  chrMap,
  objectSet,
  mapsOfFeature
} from '../utils/feature-lookup';


export default Component.extend({
  // classNames: ['goto-feature-whole'],

  store: service('store'),

  /*--------------------------------------------------------------------------*/

  // the life cycle functionality is based on draw-controls, may factor out.
  didInsertElement() {
    this._super(...arguments);
    console.log("components/goto-feature didInsertElement()", this.drawActions);
    later(function() {
      let d = $('.tooltip.ember-popover');  // make-ui-draggable
    });
    if (this.drawActions)
    this.drawActions.trigger("gotoFeatureLife", true);
  },
  willDestroyElement() {
    console.log("components/goto-feature willDestroyElement()");
    if (this.drawActions)
    this.drawActions.trigger("gotoFeatureLife", false);
    this._super(...arguments);
  },
  /*
  didRender() {
    this._super.apply(this, arguments);
  },
  */

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

  listen: on('init', function() {
    // if oa is not passed in as data then listen for it.
    if (this.get('data') === undefined)
    {
      if (this.listener === undefined)
        this.createListener();
      if (this.listener)
        this.listener.listen(true);
    }
  }),

  cleanup: on('willDestroyElement', function() {
    if (this.listener)
      this.listener.listen(false);
  }),

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


// moved to utils/feature-lookup.js : 


/*----------------------------------------------------------------------------*/
  mapsOfFeature : computed('feature1', 'data', 'oa', function (newValue) {
    console.log("mapsOfFeature", newValue);
    let store = this.get('store');
    let oa = this.get('data') || this.get('oa');
    let featureName = this.get('feature1');
    let axes = mapsOfFeature(store, oa, featureName);
    return axes;
  })


});
