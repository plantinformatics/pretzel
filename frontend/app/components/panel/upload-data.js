import ManageBase from './manage-base'

export default ManageBase.extend({

  filterOptions: {
    'cell': {'formal': 'CSV', 'icon': 'th-large'},
    'json': {'formal': 'JSON', 'icon': 'list-alt'},
  },
  filter: 'cell',

  actions: {
    changeFilter: function(f) {
      this.set('filter', f)
    }
  }
});
