import EntryBase from './entry-base';

export default EntryBase.extend({
  tagName: 'span',
  // attributes
  // classes
  actions: {
    saveEdit: function(record) {
      if (record.get('scope').length > 0) {
        this.send('setEditing', false)
        record.save()
      }
    },
  }
});
