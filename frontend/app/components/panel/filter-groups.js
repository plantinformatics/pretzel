import Ember from 'ember';

export default Ember.Component.extend({

  actions : {
    addFilterOrGroup : function () {
      console.log('addFilterOrGroup');
      this.addFilterOrGroup();
    }
  },

  addFilterOrGroup() {
    let data = this.get('data');
    data.pushObject(Ember.Object.create());
  }

});
