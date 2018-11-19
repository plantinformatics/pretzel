import Ember from "ember";

import ManageBase from './manage-base'

/* global d3 */

export default ManageBase.extend({

  init() {
    this._super();
    let store = this.get('store');

    let me = this;
    let view = me.get('view');
    let filter = {'include': 'blocks'};
    if (view == 'matrixview') {
      filter['where'] = {'type': 'observational'};
    }
    store.query('dataset', {filter: filter}).then(function(datasets) {
      me.set('datasets', datasets.toArray());
    })
  },
  datasetType: null,

  filterOptions: {
    'all': {'formal': 'All', 'icon': 'plus'},
    'private': {'formal': 'Private', 'icon': 'lock'},
    'owner': {'formal': 'Mine', 'icon': 'user'}
  },
  filter: 'all',
  layout: {
  },
  datasets: [],
  data: Ember.computed('datasets', 'filter', function() {
    let availableMaps = this.get('datasets')
    let filter = this.get('filter')
    // perform filtering according to selectedChr
    // let filtered = availableMaps //all
    if (filter == 'private') {
      let maps = availableMaps.filterBy('public', false)
      return maps
    } else if (filter == 'owner') {
      return availableMaps.filterBy('owner', true)
    } else {
      return availableMaps;
    }
  }),
  dataEmpty: Ember.computed('data', function() {
    let availableMaps = this.get('data')
    if (availableMaps && availableMaps.length > 0) { return false; }
    else { return true; }
  }),
  /** group the data in : Parent / Scope / Block
   */
  dataTree : Ember.computed('data', function() {
    let datasets = this.get('data'),
    n = d3.nest()
      .key(function(f) { let p = f.get('parent'); return p ? p.get('name') : '_'; })
      .entries(datasets);
    let grouped =
      n.reduce(
        function (result, nd) {
          result[nd.key] =
	          nd.values.reduce(function (result2, d) {
              // console.log('result2', result2, d);
              let blocks = d.get('blocks').toArray();
              let nestedBlocks=d3.nest()
                .key(function(b) { return b.get('scope'); })
                .entries(blocks),
              datasetName = d.get('name');
	            result2[datasetName] = nestedBlocks;
              return result2;
            }, {});
          return result;
        },
	      {});
    console.log('dataTree', grouped);
    return grouped;
  }),

  actions: {
    refreshAvailable() {
      let me = this;
      let view = me.get('view');
      let filter = {'include': 'blocks'};
      if (view == 'matrixview') {
        filter['where'] = {'type': 'observational'};
      }
      this.get('store').query('dataset', {filter: filter}).then(function(datasets) {
        me.set('datasets', datasets.toArray());
      });
    },
    deleteBlock(chr) {
      this.sendAction('deleteBlock', chr.id);
    },
    changeFilter: function(f) {
      this.set('filter', f)
    },
    onDelete(id) {
      
    },
    loadBlock(block) {
      this.sendAction('loadBlock', block);
    }
  }
});
