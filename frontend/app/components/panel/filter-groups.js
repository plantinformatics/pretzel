import Ember from 'ember';

export default Ember.Component.extend({

  classNames : ["filter-groups"],

  actions : {
    addFilterOrGroup : function () {
      console.log('addFilterOrGroup');
      this.addFilterOrGroup();
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
  }

});
