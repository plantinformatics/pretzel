import EntryBase from './entry-base';

export default EntryBase.extend({

  attributeBindings: ['title'],
  tagName: 'span',
  // attributes
  // classes
  actions: {
    saveEdit: function(record) {
      if (record.get('scope').length > 0) {
        this.send('setEditing', false)
        record.save()
      }
    }
  },

  blockFeaturesCountsStatus() {
    const status = this.entry?.[Symbol.for('featuresCountsStatus')];
    return status;
  },
  get classColour() {
    let btnStatus = 'success';
    const block = this.entry;
    if (block.hasTag('VCF')) {
      const
      status = this.blockFeaturesCountsStatus();
      btnStatus = status ? 'success' : 'info';
    }
    return btnStatus;
  },
  
});
