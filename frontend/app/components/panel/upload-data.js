import { alias } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import { getOwner } from '@ember/application';


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

  serverTabSelected : alias('controls.serverTabSelected')

});
