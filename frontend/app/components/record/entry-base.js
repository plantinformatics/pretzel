import Ember from 'ember';

const { Component, inject: { service } } = Ember;

export default Ember.Component.extend({
  store: service(),
  onInit: function() {
    this.set('editing', false);
  }.on('init'),
  noAuth: Ember.computed(function() {
    return window['AUTH'] === 'NONE';
  }),
  actions: {
    setEditing: function(editing) {
      this.set('editing', editing);
      this.sendAction('setEditing', editing);
    },
    enableEdit: function() {
      this.send('setEditing', true);
    },
    cancelEdit: function(record) {
      this.send('setEditing', false);
      record.rollbackAttributes();
    },
    saveEdit: function(record) {
      if (record.get('name').length > 0) {
        this.send('setEditing', false);
        record.save();
      }
    },
    flipPublic: function(record) {
      // alter publicity boolean for record
      let visible = record.get('public');
      record.set('public', !visible);
      record.save();
    },
    flipReadOnly: function(record) {
      // alter editability boolean for record
      let visible = record.get('readOnly');
      record.set('readOnly', !visible);
      record.save();
    },
    selectRecord(record) {
      this.sendAction('selectRecord', record);
    },
    deleteRecord(record) {
      let id = record.id,
        that = this;
      /** equiv : record._internalModel.modelName */
      let modelName = record.get('constructor.modelName');
      // destroyRecord() is equivalent to deleteRecord() and immediate save()
      record.destroyRecord().then(function() {
        // Don't trigger downstream effects until complete
        that.sendAction('onDelete', modelName, id);
      });
    },
    loadBlock(record) {
      this.sendAction('loadBlock', record);
    }
  }
});
