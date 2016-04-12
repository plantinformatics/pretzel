import Ember from 'ember';

export default Ember.Route.extend({
  model() {
    return this.store.findAll('user');
  },
  actions: {
    remove(model) {
      if(confirm('Are you sure?')) {
        model.destroyRecord();
      }
    }
  }
});
