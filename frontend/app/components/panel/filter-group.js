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
      /** copy initial values from data to this.
       * These are the fields defined in filter-groups.js:addFilterOrGroup() : initialFilterGroup,
       * which should be integrated with this; perhaps move initialFilterGroup to this component.
       */
      let me = this;
      [
        'filterOrGroup',
        'fieldName',
        'fieldScope',
        'fieldMeta',
        'matchKey',
        'matchValue']
        .forEach(function (fieldName) {
          if (! me.get(fieldName)) {
            me.set(fieldName, data[fieldName]);
          }
        });
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

