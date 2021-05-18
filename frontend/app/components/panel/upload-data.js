import { alias } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import { getOwner } from '@ember/application';


import ManageBase from './manage-base'

export default ManageBase.extend({
  controls : service(),


  filterOptions: {
    'fileDrop': {'formal': 'fileDrop', 'icon': 'cloud-upload'}, // or upload
    'cell': {'formal': 'CSV', 'icon': 'th-large'},
    'json': {'formal': 'JSON', 'icon': 'list-alt'},
  },
  filter: 'fileDrop',

  actions: {
    changeFilter: function(f) {
      this.set('filter', f)
    }
  },

  serverTabSelected : alias('controls.serverTabSelected')

});
