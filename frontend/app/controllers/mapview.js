import Ember from 'ember';

import { chrData } from '../utils/utility-chromosome';

console.log("controllers/mapview.js");


export default Ember.Controller.extend({

  actions: {
    updateSelectedMarkers: function(markers) {
	// console.log("updateSelectedMarkers in mapview controller", markers.length);
      this.set('selectedMarkers', markers);
    },
    toggleShowUnique: function() {
      console.log("controllers/mapview:toggleShowUnique()", this);
      this.set('isShowUnique', ! this.get('isShowUnique'));
    }
    , isShowUnique: false
    , togglePathColourScale: function() {
      console.log("controllers/mapview:togglePathColourScale()", this);
      this.set('pathColourScale', ! this.get('pathColourScale'));
    }
    , pathColourScale: true
  },

  queryParams: ['mapsToView'],
  mapsToView: [],

  availableMaps: [],

  selectedMaps: [],
  selectedMarkers: [],

  dataReceived : Ember.ArrayProxy.create({ content: Ember.A() }),

  scaffolds: undefined,
  scaffoldMarkers: undefined,
  showScaffoldMarkers : false,
  showAsymmetricAliases : false,

  markersSelected: Ember.computed('selectedMarkers', function() {
    return this.selectedMarkers.length > 0;
  }),

  numMarkers: Ember.computed('selectedMarkers', function() {
    return this.selectedMarkers.length;
  }),

  hasData: Ember.computed('selectedMaps', function() {
    return this.selectedMaps.length > 0;
  }),

  mapsToViewChanged: function (a, b, c) {
    let mtv = this.get('mapsToView'), i=mtv.length;
    if (i)
    {
      let m=mtv[i-1], im, exists;
      console.log("mapsToViewChanged", mtv.length, mtv, i, m, a, b, c);
      console.log(this.selectedMaps.length, this.selectedMaps);
      console.log(this.availableMaps.length, this.availableMaps);
      console.log(a.mapsToView.length, a.mapsToView);
      if (true)
      {
        let dataReceived = this.get('dataReceived');
        if (dataReceived)
          dataReceived.pushObject(mtv);
        else
          console.log(this);
      }
      else
/*
      for (im=0; (im < a.mapsToView.length) && !(exists = (a.mapsToView[im] === m)); im++)
      {
      }
      if (exists)
        console.log("mapsToView[", im, "] === ", m);
      if ((a.mapsToView.length === 0) || ! exists)
*/
      {
      var that = this;  // let creates a closure, which loses this

      let pc=this.store.findRecord('chromosome', m);
      let thisStore = this.store;
      pc.then(function (ch){
        console.log(ch.get('name'));
        /*
        let ppc=thisStore.peekRecord('chromosome', m);
        console.log
        (ppc._internalModel.id,
         ppc.get('map').get('name'),
         ppc.get('name'));

        let ma = ppc.get('markers');
        ma.forEach(function (cc) { console.log(cc.get('name'), cc.get('position'), cc.get('aliases'));});
        */
        let rc = chrData(ch),
        chr = ch.get('map').get('id'),
        /** Only 1 chr in hash, but use same structure as routes/mapview.js */
        retHash = {};
        retHash[chr] = rc;
        let dataReceived = that.get('dataReceived');
        if (dataReceived)
          dataReceived.pushObject(retHash /*[ppc, ma]*/);
        else
          console.log(this);
      });
      }
    }
  }//.observes('mapsToView')

});
