import Ember from 'ember';

export default Ember.Component.extend({
  store: Ember.inject.service('store'),

  classNames : ["filter-groups"],

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
