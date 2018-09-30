import Ember from 'ember';

import ManageBase from './manage-base'

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
  datasetsBlocks : [],
  datasetsBlocksRefresh : 0,
  datasets: [],
  data: Ember.computed('datasetsBlocksRefresh', 'datasetsBlocks.@each', 'filteredData', function() {
    let datasetsBlocks = this.get('datasetsBlocks'),
    filteredData = this.get('filteredData'),
    combined = filteredData;
    datasetsBlocks.forEach(function (keyAndValue) {
      let [hostUrl, add] = keyAndValue;
      combined = combined.concat(add);
    });
    return combined;
  }),
  filteredData: Ember.computed('datasets', 'filter', function() {
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
  actions: {
    receivedDatasets(datasetsHandle, blockValues) {
      console.log('receivedDatasets', datasetsHandle, blockValues);
      this.set('datasetsBlocksRefresh', this.get('datasetsBlocksRefresh')+1);
    },
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
