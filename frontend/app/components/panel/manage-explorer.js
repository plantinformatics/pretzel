import ManageBase from './manage-base'

const model_availableDatasets = "model.availableMapsTask.value";

export default ManageBase.extend({

  filterOptions: {
    'all': {'formal': 'All', 'icon': 'plus'},
    'private': {'formal': 'Private', 'icon': 'lock'},
    'owner': {'formal': 'Mine', 'icon': 'user'}
  },
  filter: 'all',
  layout: {
  },
  didInsertElement : function () {
    console.log("manage-explorer didInsertElement() model", this.get('model'));
  },
  data: Ember.computed(model_availableDatasets, 'filter', function() {
    let availableMaps = this.get(model_availableDatasets);
    console.log("manage-explorer data() availableDatasets", availableMaps);
    let filter = this.get('filter')
    // perform filtering according to selectedChr
    // let filtered = availableMaps //all
    if (filter == 'private') {
      let maps = availableMaps.filterBy('public', false)
      return maps
    } else if (filter == 'owner') {
      return availableMaps.filterBy('owner', true)
    } else {
      return this.get(model_availableDatasets)
    }
  }),
  dataEmpty: Ember.computed('data', function() {
    let availableMaps = this.get('data')
    if (availableMaps && availableMaps.length > 0) { return false; }
    else { return true; }
  }),
  actions: {
    refreshAvailable() {
      this.sendAction('updateModel')
    },
    selectBlock(chr) {
      console.log('SELECT BLOCK manage-explorer', chr)
      this.sendAction('selectBlock', chr);
    },
    deleteBlock(chr) {
      this.sendAction('deleteBlock', chr.id);
    },
    changeFilter: function(f) {
      this.set('filter', f)
    },
    onDelete(id) {
      let availMaps = this.get(model_availableDatasets)
      /** check action connection - this trace not seen (when delete from explorer);
       * entry-base deleteRecord() sends onDelete.  */
      console.log('onDelete', availMaps);
    }
  }
});
