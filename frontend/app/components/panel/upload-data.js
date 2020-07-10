import Ember from 'ember';
const { inject: { service }, getOwner } = Ember;


import ManageBase from './manage-base'

export default ManageBase.extend({
  controls : service(),


  filterOptions: {
    'cell': {'formal': 'CSV', 'icon': 'th-large'},
    'json': {'formal': 'JSON', 'icon': 'list-alt'},
  },
  filter: 'cell',

  actions: {
    changeFilter: function(f) {
      this.set('filter', f)
    }
  },

  serverTabSelected : Ember.computed.alias('controls.serverTabSelected')

});
