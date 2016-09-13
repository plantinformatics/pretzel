import Ember from 'ember';

export default Ember.Route.extend({
  queryParams: {
    mapsToView: {
      refreshModel: true
    }
  },
  model(params) {
    console.log("params to mapview route:");
    console.log(params);
    // Get all available maps.
    var maps = this.get('store').findAll('map');
    this.controllerFor("mapview").set("availableMaps", maps);
    maps.then(function(maplist){
      maplist.forEach(function(map) {
        console.log("in mapview route");
        console.log(params.mapsToView);
        var exMaps = [];
        if (params.mapsToView) {
          for (var i=0; i < params.mapsToView.length; i++) {
            exMaps.push(params.mapsToView[i]);
          }
        }
        console.log("setting " + map.id + " to");
        console.log(exMaps);
        map.set('extraMaps', exMaps);
      });
    });
    
    console.log("mapview params:");
    var retMaps = [];
    for (var i=0; i < params.mapsToView.length; i++) {
      console.log("a param");
      console.log(params.mapsToView[i]);
      retMaps.push(this.get('store').findRecord('map', params.mapsToView[i]));
    }
    return retMaps;
  }
});
