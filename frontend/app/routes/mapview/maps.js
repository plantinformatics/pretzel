import Ember from 'ember';

export default Ember.Route.extend({

  actions: {
    willTransition: function(transition) {
      console.log(transition.targetName);
      if(transition.targetName === 'mapview.index') {
        this.controllerFor("mapview").set("selected", []);
        console.log("going to mapview index route");
      }
    }
  },

  parentController: Ember.computed( function() {
    return this.controllerFor('mapview');
  }),

  setupController: function(controller, model) {
    this._super(controller, model);
  },

  model(params) {
    console.log("params to mapview/maps route:");
    console.log(params);

    // allMaps will contain all maps being loaded in this route
    // First, get the reference map.
    var allMaps = Ember.A([this.get('store').findRecord('map', params["map_id"])]);

    // Get the selected array from the parent controller.
    var selectedMaps = this.get('parentController').get('selected');
    // Add the reference map.
    selectedMaps.push(params["map_id"]);

    console.log("selectedMaps:");
    console.log(selectedMaps);

    // Parse the tail of the URL to get the maps wanted.
    var maps = params["maps"].split("/");

    for (var i=0; i < maps.length; i++) {
      // Add the returned map to the allMaps array.
      allMaps.pushObject(this.get('store').findRecord('map', maps[i]));
      // Add the map ID to the selectedMaps array.
      selectedMaps.push(maps[i]);
    }
    console.log("Return value from mapview/maps route:");
    console.log(allMaps);
    console.log("selectedMaps:");
    console.log(selectedMaps);

    // Set the parent controller selected property to the new value.
    this.get('parentController').set('selected', selectedMaps);
    // Return the maps to view.
    return allMaps;
  }
});
