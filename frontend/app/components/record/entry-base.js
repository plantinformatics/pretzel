import Ember from 'ember';

const { Component, inject: { service } } = Ember;

export default Ember.Component.extend({
  store: service(),
  onInit: function() {
    this.set('editing', false)
  }.on('init'),
  actions: {
    enableEdit: function() {
      this.set('editing', true)
    },
    cancelEdit: function(record) {
      this.set('editing', false)
      record.rollbackAttributes()
    },
    saveEdit: function(record) {
      this.set('editing', false)
      record.save()
    },
    flipPublic: function(record) {
      // alter publicity boolean for record
      let visible = record.get('public')
      record.set('public', !visible)
      record.save()
    },
    flipReadOnly: function(record) {
      // alter editability boolean for record
      let visible = record.get('readOnly')
      record.set('readOnly', !visible)
      record.save()
    },
    selectRecord(record) {
      this.sendAction('selectRecord', record);
    },
    deleteRecord(record) {
      console.log('DELETE record')
      // console.log(this.record)
      console.log(record)
      console.log(record.id)

      record.deleteRecord()
      console.log('DELETED record')
      record.save()
      console.log('SAVE record')
    },
  }
});
