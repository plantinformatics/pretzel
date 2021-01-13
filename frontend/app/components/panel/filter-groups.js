import { computed } from '@ember/object';
import { inject as service } from '@ember/service';
import Component from '@ember/component';

export default Component.extend({
  store: service('store'),

  classNames : ["filter-groups"],

  /** only the first dataset fg and the first block fg are currently used,
   * so limit data.length to 2.
   */
  maxFilterGroups : computed('data.length', function () {
    return this.get('data.length') > 1;
  }),

  actions : {
    addFilterOrGroup : function () {
      console.log('addFilterOrGroup');
      this.addFilterOrGroup();
    },
    deleteFilterOrGroup : function (filterGroup) {
      console.log('deleteFilterOrGroup', filterGroup);
      this.deleteFilterOrGroup(filterGroup);
    }
  },

  addFilterOrGroup() {
    let data = this.get('data'),
    filterGroup = this.get('store').createRecord('filter-Group');
    data.pushObject(filterGroup);
  },

  deleteFilterOrGroup(filterGroup) {
    let data = this.get('data');
    let receiver = data.removeObject(filterGroup);
    console.log('deleteFilterOrGroup', filterGroup, data, receiver);
    filterGroup.destroy();
  }

});
