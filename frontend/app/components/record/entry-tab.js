import Ember from 'ember';

import {tab_explorer_prefix, text2EltId } from '../../utils/explorer-tabId';

/**
 * @param name  type name of the data in the tab
 * @param values  values of the data in the tab
 */
export default Ember.Component.extend(Ember.Evented, {

  attributeBindings: ['id'],
  classNames : ['tab-pane', 'fade', 'in'],


  id : Ember.computed('name', function () {
    let name = this.get('name'),
    id = tab_explorer_prefix + text2EltId(name);
    console.log('id', id, name);
    return id;
  }),

  actions : {
    selectBlockAndDataset(block) {
      var dataset = block.get('datasetId.content') || block.get('datasetId');
      console.log('selectBlockAndDataset', 'block => ', block.get('name'),
                  'dataset => ', dataset.get('name'));
      this.sendAction('selectDataset', dataset);
      this.sendAction('selectBlock', block);
    },
    selectDataset(dataset) {
      this.sendAction('selectDataset', dataset);
    },
    loadBlock(block) {
      this.sendAction('loadBlock', block);
    },
    allActiveChanged(active) {
      console.log('allActiveChanged', active, this.get('allActive'), this);
      this.trigger('setLayoutActive', active);
    }
  }

});
