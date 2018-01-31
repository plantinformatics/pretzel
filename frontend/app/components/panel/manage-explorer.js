import ManageBase from './manage-base'

export default ManageBase.extend({

  filterOptions: {
    'all': {'formal': 'All', 'icon': 'plus'},
    'private': {'formal': 'Private', 'icon': 'lock'},
    'owner': {'formal': 'Mine', 'icon': 'user'}
  },
  filter: 'all',
  layout: {
  },
  data: Ember.computed('model.mapsDerived.availableMaps', 'filter', function() {
    let availableMaps = this.get('model.mapsDerived.availableMaps')
    let filter = this.get('filter')
    // perform filtering according to selectedChr
    // let filtered = availableMaps //all
    if (filter == 'private') {
      let maps = availableMaps.filterBy('public', false)
      return maps
    } else if (filter == 'owner') {
      return availableMaps.filterBy('owner', true)
    } else {
      return this.get('model.mapsDerived.availableMaps')
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
      let availMaps = this.get('model.mapsDerived.availableMaps')
      let newMaps = []
      for (var i=0; i<availMaps.length; i++) {
        if (availMaps[i].id != id) {
          newMaps.push(availMaps[i])
        }
      }
      this.set('model.mapsDerived.availableMaps', newMaps)
    }
  }
});
