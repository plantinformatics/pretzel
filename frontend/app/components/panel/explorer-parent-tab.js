import Component from '@ember/component';
import { computed } from '@ember/object';

import { datasetTypeTabId } from '../../utils/explorer-tabId';

const dLog = console.debug;

/** Implement the parent type tabs of the dataset explorer.
 * This selects the trees of dataTypedTreeFG / dataParentTypedFGTree.
 *
 * @param tab	BsTab - wraps Bootstrap nav-tabs
 * @param nav	BsNav - wraps Bootstrap nav-tabs <li>
 * @param tabTypeName	name of parent type
 * @param tabData	top level of data tree for tabTypeName, used to show top-level count.
 * @param nameSuffix	append to datasetTypeTabId(tabTypeName) to make it unique
 */
export default Component.extend({

  tagName : 'li',

  //----------------------------------------------------------------------------
  actions: {

    /** invoked from hbs via {{compute (action "datasetTypeTabId" datasetType ) }}
     * @return string suitable for naming a html tab, based on datasetType name.
     */
    datasetTypeTabId : datasetTypeTabId,

    /** invoked from hbs via {{compute (action 'keysLength' tabData }}
     * @return number of datasets, which are the top level of tabData 
     * @param object	tabData
     */
    keysLength(object) {
      return Object.keys(object).length;
    },

  },  // actions

  tabId : Ember.computed('tabTypeName', function () {
    return datasetTypeTabId(this.get('tabTypeName'));
  }),
  tab : computed.alias('parentView.parentView'),
  activeId : computed.alias('tab.isActiveId'),  // .activeId ?
  eqActive : Ember.computed('tabId', 'activeId', function () {
    let active = this.get('activeId') === this.get('tabId');
    dLog('eqActive', active, this.get('activeId'), this.get('tabId'));
    return active;
  }),


  //----------------------------------------------------------------------------

  
});
