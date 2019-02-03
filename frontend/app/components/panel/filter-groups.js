import Ember from 'ember';

export default Ember.Component.extend({

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
    initialFilterGroup = {
      filterOrGroup: 'filter',
      fieldName : true,
      fieldScope : true,
      fieldNamespace : true,
      fieldMeta : true,
      matchKey : true,
      matchValue : true
    };
    data.pushObject(Ember.Object.create(initialFilterGroup));
  },

  deleteFilterOrGroup(filterGroup) {
    let data = this.get('data');
    let receiver = data.removeObject(filterGroup);
    console.log('deleteFilterOrGroup', filterGroup, data, receiver);
    filterGroup.destroy();
  }

});
