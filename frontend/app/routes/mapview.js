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
      var maps = that.get('store').findAll('geneticmap');

      maps.then(function(genmaps) {	//
      that.controllerFor("mapview").set("availableMaps", genmaps);
      genmaps.forEach(function(map) {
        var exMaps = [];
        map.set('isSelected', false); // In case it has been de-selected.
        if (params.mapsToView) {
	    let mapId = map.get('id');
	    console.log("mapId=" + mapId + ", " + params.mapsToView.length);
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
        else {
          that.controllerFor("mapview").set("availableChrs", []);
        }
        map.set('extraMaps', exMaps);
      });
	  // return Ember.RSVP.resolve({genmaps: genmaps, mapsToView: params.mapsToView, selMaps: selMaps});
    });

      console.log("maps: " + maps);

      let label = "processMapsDetail";
      let resultPromise =
	  maps.then(
	      processMapsDetail,
	  function (err) { console.log("mapview:model() failed to " + label + err); },
	  label
	  );

      function processMapsDetail(genmaps)
      {
	  genmaps.forEach(function(map) {
	  
	// wrap map names in promises
	  let wrappedNamesPromises = 
	params.mapsToView.map(function(mapName){
	    return Ember.RSVP.resolve(mapName);
	});
	  let getExtPromises = 
	  Ember.RSVP.map(wrappedNamesPromises,
	    function(param) {
		let mapPromise =
		    that.get('store').findRecord('geneticmap', param).then(function(map) {	//
			let label = "get " + param + ";" + map + " .extended. ";
			let mapDetailWrapPromise =
			    map.get('extended').then(	//
			    function (result) { return new Ember.RSVP.resolve({parentMap: param, mapDetail: map, result: result}); },
			    function (err) { console.log("mapview:model() failed to " + label + err); },
			    label
			);
			return mapDetailWrapPromise;
		    });
		return mapPromise;
	    });
    // promises[mapName] is getting detail of map, bundled with name
	  return getExtPromises.then(function(nameAndDetailArray) {	//
	      console.log("nameAndDetailArray=" + nameAndDetailArray.length);
	      nameAndDetailArray.forEach
	      (function (nameAndDetail)
	       {
        let mapName = nameAndDetail.parentMap;
	let param = nameAndDetail.mapDetail;
        retHash = {};
        nameAndDetail.result.get('chromosomes').forEach(function(chr) {	//
          let chrName = chr.get('name');
          console.log(chrName);
          seenChrs.add(chrName);
          that.controllerFor("mapview").set("availableChrs", Array.from(seenChrs).sort());
          console.log(seenChrs);
          if (chrName == params.chr) {
            retHash[mapName+"_"+chrName] = [];
            chr.get('markers').forEach(function(marker) {
              retHash[mapName+"_"+chrName].pushObject(
                {"map": mapName+"_"+chrName,
                 "marker": marker.get('name'),
                 "location": marker.get('position')
                }
              );
            });
          }
        });
	  let label = "wrap retHash in Promise;" + mapName;
	  return new Ember.RSVP.Promise(
	      function (resolve, reject) { resolve(retHash);},
	      function (err) { console.log("mapview:model() failed to " + label + err); },
	       label
	      );
	       });	// nameAndDetailArray.forEach
	  });		// getExtPromises.then()
	      });	// genmaps.forEach
      }	// processMapsDetail()
      return resultPromise;
  }	// model()

});
