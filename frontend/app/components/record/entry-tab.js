import Ember from 'ember';

import {tab_explorer_prefix, text2EltId } from '../../utils/explorer-tabId';
import { leafCount } from '../../utils/value-tree';


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

  /** Automatically enable allActive if the number of leaves (blocks) is reasonably small,
   * e.g if the result of filter is <20 blocks then show then all.
   * This can apply to grouping also, but the number of unfiltered blocks will
   * be typically be sufficient that allActive should be initially false.
   */
  autoAllActive : Ember.computed('values', function () {
    let values = this.get('values');
    let levelMeta = this.get('levelMeta');
    /** Walk the value tree and count leaves (blocks). */
    let count = leafCount(levelMeta, values);
    let autoAllActive = count < 50;
    console.log('autoAllActive', this.get('name'), values, autoAllActive, count);
    /* only set when values change; this provides an initial default state which
     * the user can toggle. */
    Ember.run.once(
      () => this.set('allActive', autoAllActive));
    return autoAllActive;
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
