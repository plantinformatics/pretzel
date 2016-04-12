import Ember from 'ember';

export default Ember.Mixin.create({
  deactivate() {
    if (this.currentModel.get('isNew')) {
      this.currentModel.deleteRecord();
    } else {
      this.currentModel.rollbackAttributes();
    }
  },
  actions: {
    save() {
      this.currentModel.save().then(() => {
        this.transitionTo(this.routeName.split('.').slice(0, -1).join('.'));
      }, () => {
        console.log('Failed to save the model');
      });
    }
  }
});
