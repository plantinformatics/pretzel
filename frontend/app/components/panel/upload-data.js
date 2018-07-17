import ManageBase from './manage-base'

const { inject: { service } } = Ember;

export default ManageBase.extend({
  session: service('session'),

  filterOptions: {
    'cell': {'formal': 'CSV', 'icon': 'th-large'},
    'json': {'formal': 'JSON', 'icon': 'list-alt'},
  },
  filter: 'cell',

  allowUpload: Ember.computed('session', function() {
    if (window['AUTH'] !== 'NONE' && !this.get('session').get('isAuthenticated')) {
      return false;
    }
    return true;
  }),

  actions: {
    changeFilter: function(f) {
      this.set('filter', f)
    }
  }
});
