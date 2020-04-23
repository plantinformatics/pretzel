import Ember from 'ember';

const { inject: { service }, Component } = Ember;

export default Component.extend({
  tagName : 'li',

  didRender : function() {
    let endpoint = this.get('apiEndpoint'),
    firstTab = endpoint.get('firstTab');
    if (firstTab)
    {
      console.log('didRender', firstTab, this, endpoint.name);
      endpoint.set('firstTab', false);
      this.addClassActive();
    }
  },

  addClassActive : function()
  {
    let li = this.element;
    console.log('addClassActive', this.name, li, li && li.classList);
    li.classList.add("active");
  }
  
});
