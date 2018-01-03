import Record from './manage-record';

export default Record.extend({
  tagName: 'li',
  // attributes
  // classes
  classNames: ['list-group-item'],
  initSteps: function() {
    let layout = {
      'active': false
    }
    this.set('layout',layout);
  }.on('init'),
  actions: {
  }
});
