import Component from '@ember/component';
import { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import { later } from '@ember/runloop';

import { htmlSafe } from '@ember/template';

/* global CSS */

export default Component.extend({
  apiServers: service(),

  style: htmlSafe('height:100%'),
  attributeBindings: ['style:style'],
  view: 'mapview',
  /** The elements of this component are initially shown. toggled in toggleLeftPanel(). */
  shown : true,

  /** Determine if the 'Selected Server' <Panel::SelectedServer> should be displayed.
   * There is no need to display it if the number of api servers is 1, i.e. only
   * connected to the primary pretzel server.
   */
  multipleServers : alias('apiServers.multipleServersCP'),

  /** Return a list of datasets, with their included blocks, for the currently-selected
   * API server tab
   *
   * This has the essentials from panel/manage-explorer.js : datasetsBlocks(),
   * and can probably replace it; left-panel can pass this value to manage-explorer.
   * Exclude copies from secondary servers, as is done in manage-explorer : datasetsBlocks().
   * Currently used by just sequence-search and upload-data,
   * in place of this.datasets, which is from mapview .dataset, which see.
   */
  serverSelected_datasetsBlocks : computed(
    'apiServers.serverSelected.datasetsBlocks.[]',
    function () {
      return this.get('apiServers.serverSelected.datasetsBlocksOriginal') || [];
    }),

  /** Define class 'shown' if .shown is true
   * see toggleLeftPanel().
   * May be used in future in place of jQuery $(".left-panel-shown").toggle() (also '-hidden').
   * Currently the hbs uses :  (if this.shown '' 'hidden') instead of this.
   */
  classNamesShown : computed('shown', function () {
    return this.shown ? ['shown'] : '';
  }),

  actions: {
    toggleLeftPanel(shown) {
      $(".left-panel-shown").toggle();
      $(".left-panel-hidden").toggle();
      $(".left-panel-shown").trigger('toggled', [shown]);
      later(() => this.set('shown', shown));
    },
    /** Change to the named tab.
     * @param select  this is @action select() defined in ember-bootstrap/addon/components/base/bs-tab.js
     * @param tab name of tab to go to; without the prefix 'left-panel-'
     * @desc Usage :
     *   left-panel.hbs : changeTab=(action 'changeTab' tab.select )
     *   manage-explorer.hbs : onClick=(action "changeTab" "upload")
     */
    changeTab(select, tab) {
      select('left-panel-' + tab);
    },
  }
});
