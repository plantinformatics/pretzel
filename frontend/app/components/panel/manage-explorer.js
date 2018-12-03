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
  /** group the data in : Dataset / Block
   * Used for datasets without a parent
   */
  byDataset : Ember.computed('data', function() {
    let datasets = this.get('data'),
    noParent = datasets.filter(function(f) { 
      let p = f.get('parent');
      console.log('byDataset', f, p, p.get('content'));
      return ! p.get('content');
    });
    return noParent;
  }),
  /** group the data in : Parent / Scope / Block
   */
  dataTree : Ember.computed('data', function() {
    let datasets = this.get('data'),
    withParent = datasets.filter(function(f) {
      let p = f.get('parent');
      return p.get('content'); }),
    n = d3.nest()
      .key(function(f) { let p = f.get('parent'); return p ? p.get('name') : '_'; })
      .entries(withParent);
    /** this reduce is mapping an array  [{key, values}, ..] to a hash {key : value, .. } */
    let grouped =
      n.reduce(
        function (result, datasetsByParent) {
          result[datasetsByParent.key] =
	          datasetsByParent.values.reduce(function (blocksByScope, dataset) {
              // console.log('blocksByScope', blocksByScope, dataset);
              let blocks = dataset.get('blocks').toArray();
              blocks.forEach(
                function (b) {
                  let scope = b.get('scope'),
                  blocksOfScope = blocksByScope[scope] || (blocksByScope[scope] = []);
                  blocksOfScope.push(b);
                });
              return blocksByScope;
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
