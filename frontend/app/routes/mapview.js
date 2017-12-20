import Ember from 'ember';
import AuthenticatedRouteMixin from 'ember-simple-auth/mixins/authenticated-route-mixin';

const { RSVP: { Promise } } = Ember;
const { Route } = Ember;

let trace_promise = 1;

let config = {
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
   *
   * mapsDerived.selectedMaps is different to draw-map.js: oa.selectedAps,
   * which is the brushed APs (maps).
   */

  model(params) {

    // Get all available maps.
    let selMaps = [];
    let that = this;
    let result;
    /** collation of all chrs of all maps.  value is currently true, could be a refn to parent map. */
    let availableChrs = {}; // or new Set();
    /** These values are calculated from the list of available maps when maps promise resolves.
     availableChrs : availableChrs,
     selectedMaps: selMaps;
     */
    let mapsDerivedValue = {availableChrs: availableChrs, selectedMaps: selMaps};

    let seenChrs = new Set();
    var maps = that.get('store').query(
      'dataset',
      {
        filter: {
          'include': 'blocks'
        }
      }
    )
    .then(function(genmaps) {
      // that.controllerFor("mapview").set("availableMaps", genmaps);
      console.log("routes/mapview model()", params.mapsToView.length, params.mapsToView);
      mapsDerivedValue.availableMaps = genmaps.toArray();
      if (trace_promise > 1)
        console.log("genmaps.toArray()", mapsDerivedValue.availableMaps);
      genmaps.forEach(function(map) {
        let chrs = map.get('blocks');
        chrs.forEach(function(chr) {
          var exChrs = [];
          mapsDerivedValue.availableChrs[chr.get('id')] = map.get('name'); // or true; // could be map or map.get('id');
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
              }
            }
          }
          chr.set('extraChrs', exChrs);
        });
      });
      return Promise.resolve(mapsDerivedValue);
    },
      function(reason) {
        console.log("findAll geneticmap", reason);
      }
    );
    let promises = {};

    params.mapsToView.forEach(function(param) {
      if (trace_promise > 1)
        console.log("findRecord", param);
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

      /* previous functionality was approx equiv to :
       * afterChrPromise(promises[param]), but it put data for chr in result[chr]
       * instead of rc, and returned result.
       * An alternative to returning array of promises : use afterChrPromise(), but
       * instead of call to receiveChr(), send via dataReceived:
       * this.send('receivedChr', rc, c.get('name'));
       */
    });

    if (trace_promise > 1)
      maps.then(function (result) { console.log("maps result", result, maps._result); });

    let ObjectPromiseProxy = Ember.ObjectProxy.extend(Ember.PromiseProxyMixin);
    if (trace_promise > 1)
    {
      let a= ObjectPromiseProxy.create({promise: maps});
      a.then(function (result) { console.log("maps result 2", result, "availableChrs", result.availableChrs, "availableMaps", result.availableMaps); });
    }
    result =
      {chrPromises: promises,
       mapsToView : params.mapsToView,
       mapsDerived : ObjectPromiseProxy.create({promise: maps}),
       mapsPromise : maps,
       highlightMarker: params.highlightMarker
      };
    console.log("routes/mapview: model() result", result);
    return result;

  }

}

var args = [config]

if (window['AUTH'] !== 'NONE') {
  args.unshift(AuthenticatedRouteMixin);
}

export default Ember.Route.extend(...args);
