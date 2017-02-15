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
        var exMaps = [];
        map.set('isSelected', false); // In case it has been de-selected.
        if (params.mapsToView) {
          for (var i=0; i < params.mapsToView.length; i++) {
            if (map.get('id') != params.mapsToView[i]) {
              exMaps.push(params.mapsToView[i]);
            }
            else {
              map.set('isSelected', true);
              selMaps.push(map);
              that.controllerFor("mapview").set("selectedMaps", selMaps);
            }
          }
        }
        map.set('extraMaps', exMaps);
      });
    });

    let promises = {};

    params.mapsToView.forEach(function(param) {
      promises[param] = that.get('store').findRecord('geneticmap', param).then(function(map) {
        return map.get('extended');
      });
    });
    
    return Ember.RSVP.hash(promises).then(function(extendedMaps) {
      params.mapsToView.forEach(function(param) {
        let mapName = param;
        retHash[mapName] = {};
        extendedMaps[param].get('chromosomes').forEach(function(chr) {
          let chrName = chr.get('name');
          console.log(chrName);
          seenChrs.add(chrName);
          that.controllerFor("mapview").set("availableChrs", Array.from(seenChrs).sort());
          console.log(seenChrs);
          if (chrName == params.chr) {
            retHash[mapName][mapName+"_"+chrName] = [];
            chr.get('markers').forEach(function(marker) {
              retHash[mapName][mapName+"_"+chrName].pushObject(
                {"map": mapName+"_"+chrName,
                 "marker": marker.get('name'),
                 "location": marker.get('position')
                }
              );
            });
          }
        });
      });
      return retHash;
    });
  }
});
