import Component from '@ember/component';

import { htmlSafe } from '@ember/template';

/* global CSS */

export default Component.extend({
  style: htmlSafe(CSS.escape('height:100%')),
  attributeBindings: ['style:style'],
  view: 'mapview',

  actions: {
    toggleLeftPanel() {
      $(".left-panel-shown").toggle();
      $(".left-panel-hidden").toggle();
      $(".left-panel-shown").trigger('toggled');
    },
    loadBlock(block) {
      this.sendAction('loadBlock', block);
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
    selectBlock(block) {
      this.sendAction('selectBlock', block);
    },
    removeBlock(block) {
      this.sendAction('removeBlock', block);
    },
    selectDataset(dataset) {
      this.sendAction('selectDataset', dataset);
    },
    updateFeaturesInBlocks(featuresInBlocks) {
      this.sendAction('updateFeaturesInBlocks', featuresInBlocks);
    }
  }
});
