import Ember from 'ember';

export default Ember.Route.extend({
  titleToken: 'MapView',

  queryParams: {
    mapsToView: {
      // The initial architecture (up until feature/render-promises) was for changes in the URL mapsToView query parameter to trigger
      // a model refresh, using :
      // refreshModel: true
      //
      // Instead : controller : mapsToViewChanged() .observes('mapsToView'),
      // does store.findRecord(chromosome) and delivers the data or promise via
      // dataReceived.
      replace : true
    },
    chr: {
      refreshModel: true
    },
    highlightMarker: {
      refreshModel: false
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

  /** chr.extraChrs (aka exChrs) is the list of chrs which are in params.mapsToView
   * other than this chr.
   * Used in :
   *  chrDeleteLink():  extraChrs - this chr
   *  chrLink():        extraChrs + this chr
   *
   * Suggested changes: the filter in chrDeleteLink makes it unnecessary for
   * each chr having its own copy of extraChrs, instead simply use
   * params.mapsToView, or a hash computed from mapsToView which would make
   * it easier to filter out this chr.
   * Currently the filter is not needed, because this chr is excluded from
   * extraChrs by in the model() below.
   *
   * selectedMaps[] is almost a copy of params.mapsToView[], except that maps in
   * params which are not chrs in API result are filtered out, i.e.
   * store .findAll('geneticmap') .forEach() .get('chromosomes')
   */

  model(params) {

    // Get all available maps.
    let selMaps = [];
    let that = this;
    let retHash = {};
    /** collation of all chrs of all maps.  value is currently true, could be a refn to parent map. */
    let availableChrs = {}; // or new Set();
    if (params.highlightMarker)
      retHash.highlightMarker = params.highlightMarker;
    let seenChrs = new Set();
    var maps = that.get('store').findAll('geneticmap').then(function(genmaps) {
      that.controllerFor("mapview").set("availableMaps", genmaps);
      console.log("routes/mapview model()", params.mapsToView.length, params.mapsToView);
      genmaps.forEach(function(map) {
        let chrs = map.get('chromosomes');
        chrs.forEach(function(chr) {
          var exChrs = [];
          availableChrs[chr.get('id')] = map.get('name'); // or true; // could be map or map.get('id');
          chr.set('isSelected', false); // In case it has been de-selected.
          // console.log(chr, map);
          chr.set('map', map);  // reference to parent map
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
      that.controllerFor("mapview").set('availableChrs', availableChrs);
    });

    let promises = {};

    params.mapsToView.forEach(function(param) {
      promises[param] = that.get('store').findRecord('chromosome', param, { reload: true });
    });

    return Ember.RSVP.hash(promises).then(function(chrs) {
      d3.keys(chrs).forEach(function(chr) {
        let c = chrs[chr],
        rc = retHash[chr] = {mapName : c.get('map').get('name'), chrName : c.get('name')};
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
