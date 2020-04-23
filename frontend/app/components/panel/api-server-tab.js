import Ember from 'ember';

const { inject: { service }, Component } = Ember;

export default Component.extend({
  tagName : 'li',

  didRender : function() {
    let server = this.get('apiServer'),
    firstTab = server.get('firstTab');
    if (firstTab)
    {
      console.log('didRender', firstTab, this, server.name);
      server.set('firstTab', false);
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
