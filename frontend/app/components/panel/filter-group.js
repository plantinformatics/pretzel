import Ember from 'ember';

export default Ember.Component.extend({

  didRender() {
    this._super(...arguments);
    let data = this.get('data');
    if (! data.component) {
      if (data.set) {
        data.set('component', this);
      } else {
        data.component = this;
      }
    }
  },


  actions : {
    changeFilterOrGroup : function (value) {
      console.log('changeFilterOrGroup', value);
      this.changeFilterOrGroup();
      this.sendAction('changed', this);
    }
  },

  changeFilterOrGroup(value) {
    this.set('filterOrGroup', value);
  }

});

