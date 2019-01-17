import Ember from 'ember';

/**
 * @param name  type name of the data in the tab
 * @param values  values of the data in the tab
 */
export default Ember.Component.extend({

  attributeBindings: ['id'],
  classNames : ['tab-pane', 'fade', 'in'],


  id : Ember.computed('name', function () {
    return "tab-explorer-" + this.get('name');
  }),

  actions : {
    selectBlockAndDataset(block) {
      var dataset = block.get('datasetId');
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
    }
  }

});
