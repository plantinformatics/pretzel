import Ember from 'ember';
import AuthenticatedRouteMixin from 'ember-simple-auth/mixins/authenticated-route-mixin';

const { Route } = Ember;

export default Ember.Route.extend(AuthenticatedRouteMixin, {
  titleToken: 'MapView',
  queryParams: {
    mapsToView: {
      // The initial architecture (up until feature/render-promises) was for changes in the URL mapsToView query parameter to trigger
      // a model refresh, using :
       refreshModel: true
      //
      // Instead : controller : mapsToViewChanged() .observes('mapsToView'),
      // does store.findRecord(chromosome) and delivers the data or promise via
      // dataReceived.
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

  model(params) {

    // Get all available maps.
    let selMaps = [];
    let that = this;
    let retHash = {};
    if (params.highlightMarker)
      retHash.highlightMarker = params.highlightMarker;
    let seenChrs = new Set();
    var maps = that.get('store').query(
      'geneticmap',
      {
        filter: {
          'include': 'chromosomes'
        }
      }
    )
    .then(function(genmaps) {
      that.controllerFor("mapview").set("availableMaps", genmaps);
      genmaps.forEach(function(map) {
        let chrs = map.get('chromosomes');
        chrs.forEach(function(chr) {
          var exChrs = [];
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
    });

    let promises = {};

    params.mapsToView.forEach(function(param) {
      promises[param] = that.get('store').findRecord(
        'chromosome',
        param,
        {
          reload: true,
          adapterOptions:{
          filter: {
            'include': 'markers'
          }}
        }
      );
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
