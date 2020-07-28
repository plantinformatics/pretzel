import Ember from 'ember';

const { inject: { service }, Component } = Ember;

export default Component.extend({
  apiServers: service(),

  /** Lookup the tab <li> element in the data explorer corresponding to this API server.
   *
   * Not used or required, it was part of addClassActive() which was implemented
   * here first, but moved to api-server-tab.js.   Possibly commit and then drop it.
   */
  tabElement : function()
  {
    // this.name is e.g. "http___localhost_5000"
    /** e.g. "tab-localhost_5000" */
    let idt = this.name.replace(/https?___/, 'tab-');
    /** reference to the <a>. */
    let a = Ember.$('[href="#'+idt+'"]'),
    /** reference to the <li> which contains the <a>. */
    li = a[0].parentElement;
    console.log('tabElement', this.name, a, a[0], li, li.classList);
    return li;
    // example of use :
    // li.classList.add("active");
  },

  /**
   * @param server
   */
  getDatasets : function (server) {
    server.getDatasets();
  },

  actions: {
    getDatasets : function () {
      let server = this.get('data');
      console.log('action getDatasets', this, server);
      this.getDatasets(server);
    }
  }

});
