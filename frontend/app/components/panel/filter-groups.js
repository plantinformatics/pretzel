import Ember from 'ember';

export default Ember.Component.extend({

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
      fieldMeta : true,
      matchKey : true,
      matchValue : true
    };
    data.pushObject(Ember.Object.create(initialFilterGroup));
  }

});
