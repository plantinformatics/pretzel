import ManageBase from './manage-base'

const model_availableDatasets = "dataset.values";

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
    let availableMaps = this.get('data');
    let hasData = availableMaps && availableMaps.get('length') > 0;
    return ! hasData;
  }),
  actions: {
    refreshAvailable() {
      this.sendAction('updateModel')
    },
    selectBlock(chr) {
      console.log('SELECT BLOCK manage-explorer', chr)
      this.sendAction('selectBlock', chr);
    },
    loadBlock(block) {
      this.sendAction('loadBlock', block);
    },
    deleteBlock(chr) {
      this.sendAction('deleteBlock', chr.id);
    },
    changeFilter: function(f) {
      this.set('filter', f)
    },
    /** receives action from entry-base deleteRecord()
     * @param id  block or dataset id
     */
    onDelete(modelName, id) {
      console.log('onDelete', modelName, id);
      this.sendAction('onDelete', modelName, id);
    }
  }
});
