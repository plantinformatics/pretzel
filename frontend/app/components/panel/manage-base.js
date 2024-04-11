import Component from '@ember/component';
import { inject as service } from '@ember/service';

/**
 * manage-base (ManageBase) is inherited by these Components :
 *   manage-explorer manage-dataset manage-block manage-features
 *   manage-search manage-view upload-data 
 */
export default Component.extend({
  store: service(),
  tagName: 'div',
  // attributes
  // classes
  classNames: ['panel-section'],
  // actions
  actions: {
    /** mapview setTab is not passed to any instance of manage-base. */
    changeTab(tab) {
      /** in left-panel.hbs changeTab is passed to manage-explorer and
       * manage-view, but not other instances of manage-base.
       */
      this.changeTab?.(tab);
    },
    selectDataset(dataset) {
      this.selectDataset(dataset);
    }
  },
});
