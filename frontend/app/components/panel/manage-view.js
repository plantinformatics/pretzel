import { computed } from '@ember/object';
import { inject as service } from '@ember/service';

import { text2EltId, keysLength } from '../../utils/explorer-tabId';

import ManageBase from './manage-base'

// -----------------------------------------------------------------------------

const dLog = console.debug;

let trace = 0;

const tab_view_prefix = "tab-view-";

// -----------------------------------------------------------------------------

export default ManageBase.extend({
  trait : service('data/trait'),
  ontology : service('data/ontology'),
  block : service('data/block'),
  ontology : service('data/ontology'),



  showChartOptions : false,

  isMapview: computed('view', function() {
    let view = this.get('view');
    if (view == 'mapview') {
      return true;
    }
    return false;
  }),

  hasDisplayData: computed('displayData.[]', function() {
    let displayData = this.get('displayData');
    if (displayData && displayData.length > 0) {
      return true;
    }
    return false;
  }),

  // ---------------------------------------------------------------------------

  /** comments as in manage-explorer.js */
  activeId : 'tab-view-Blocks',

  /** invoked from hbs via {{compute (action this.datasetTypeTabId datasetType ) }}
   * @return string suitable for naming a html tab, based on datasetType name.
   */
  datasetTypeTabId(datasetType) {
    let
    id = tab_view_prefix + text2EltId(datasetType);
    if (trace)
      dLog('datasetTypeTabId', id, datasetType);
    return id;
  },
  keysLength,

  onChangeTab(id, previous) {
    dLog('onChangeTab', this, id, previous, arguments);

    this.set('activeId', id);
    // tab_view_prefix
    let name = id.replace(/^tab-view-/, '');
    this.viewedSettings.onChangeTab(name);
  },


  // ---------------------------------------------------------------------------

  actions: {
    loadBlock(block) {
      this.sendAction('loadBlock', block);
    },
    removeBlock(block) {
      this.sendAction('removeBlock', block);
    },
    removeDisplayData() {
      let me = this;
      let displayData = this.get('displayData');
      for (let i=displayData.length-1; i >= 0; i--) {
        me.send('removeBlock', displayData[i]);
      }

      this.get('ontology').ontologyIsVisibleClearAll();
      this.get('trait').visibleClearAll();
    }
  },

  // ---------------------------------------------------------------------------

  viewedSettingsChanged(settings, changedFieldName) {
    dLog('viewedSettingsChanged', changedFieldName, changedFieldName ? settings[changedFieldName] : settings);
    this.viewedSettings = settings;
  },

  // ---------------------------------------------------------------------------

});
