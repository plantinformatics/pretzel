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
      let data = this.get('data');
      console.log('changeFilterOrGroup', this, data, value);
      this.changeFilterOrGroup(value);
      this.sendAction('changed', this);
    }
  },

  changeFilterOrGroup(value) {
    let data = this.get('data');
    this.set('filterOrGroup', value);
  }

});

