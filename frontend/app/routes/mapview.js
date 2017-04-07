import Ember from 'ember';

export default Ember.Route.extend({
  queryParams: {
    mapsToView: {
      // We want changes in the URL mapsToView query parameter to trigger
      // a model refresh.
      refreshModel: true
    },
    chr: {
      refreshModel: true
    }
  },

  serializeQueryParam: function(value, urlKey, defaultValueType) {
    // This serializes what gets passed to the link-to query parameter.
    // Without it, an array simply gets JSON.stringified, for example:
    // [1,2] becomes "[1,2]" and treated as a string.
    if (defaultValueType === 'array') {
      return value;
    }
    return '' + value;
  }, 

  deserializeQueryParam: function(value, urlKey, defaultValueType) {
    return value;
  },

  model(params) {

    // Get all available maps.
    let selMaps = [];
    let that = this;
    let retHash = {};
    let seenChrs = new Set();
    var maps = that.get('store').findAll('geneticmap').then(function(genmaps) {
      that.controllerFor("mapview").set("availableMaps", genmaps);
      genmaps.forEach(function(map) {
        let chrs = map.get('chromosomes');
        chrs.forEach(function(chr) {
          var exChrs = [];
          chr.set('isSelected', false); // In case it has been de-selected.
          if (params.mapsToView) {
            for (var i=0; i < params.mapsToView.length; i++) {
              if (chr.get('id') != params.mapsToView[i]) {
                exChrs.push(params.mapsToView[i]);
              }
              else {
                chr.set('isSelected', true);
                selMaps.push(chr);
                that.controllerFor("mapview").set("selectedMaps", selMaps);
              }
            }
          }
          chr.set('extraChrs', exChrs);
        });
      });
    });

    let promises = {};

    params.mapsToView.forEach(function(param) {
      promises[param] = that.get('store').findRecord('chromosome', param, { reload: true });
    });

    return Ember.RSVP.hash(promises).then(function(chrs) {
      d3.keys(chrs).forEach(function(chr) {
        retHash[chr] = {};
        let m = chrs[chr].get('markers');
        m.forEach(function(marker) {
          let markerName = marker.get('name');
          let markerPosition = marker.get('position');
          let markerAliases = marker.get('aliases');
          retHash[chr][markerName] = {location: markerPosition, aliases: markerAliases};
        });
      });
      return retHash;
    });
  }
});
