import { computed } from '@ember/object';
import { inject as service } from '@ember/service';
import Component from '@ember/component';
import { htmlSafe } from '@ember/template';
import { later } from '@ember/runloop';



/* global CSS */

const dLog = console.debug;

export default Component.extend({
  /** nav.item now provides <li> */
  tagName : '',

  didRender : function() {
    this._super.apply(this, arguments);
    this.firstTabActive();
  },
  firstTabActive() {
    let server = this.get('apiServer'),
    /** app starts with 1 tab, which is given state 'active'.  */
    firstTab = server.get('firstTab');
    if (firstTab)
    {
      console.log('didRender', firstTab, this, server.name);
      later(() => server.set('firstTab', false));
      // tab.select() replaces this.addClassActive();
      let tabId = this.get('tabId');
      dLog('didRender', this.attrs.nav.active, this.attrs.tab.activeId);
      if (false) {  // causes : "infinite rendering invalidation detected"
      this.attrs.tab.select(tabId);
      }
    }
  },

  tabId : computed('apiServer.tabId', function () {
    let tabId = 'tab-' + this.get('apiServer.tabId');
    return tabId;
  }),

  borderStyle : computed('apiServer.name', function() {
    let apiServerColour = this.get('apiServer').get('colour'),
    style = 'border-color:' + apiServerColour;
    dLog('borderStyle', apiServerColour, this.apiServerName);
    return htmlSafe(style);
  })
  
});
