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
    addEntry: function() {
      let duplicate = this.get('duplicateTag')
      if (!duplicate) {
        let new_tag = this.get('newTag')
        let block = this.get('block')
        if (new_tag) {
          let new_tags = block.get('tags') || []
          new_tags.push(new_tag)
          block.set('tags', new_tags)
          block.save()
        }
        this.set('newTag', '')
      }
    },
    switchGeneticmap(geneticmap) {
      console.log('switchGeneticmap')
      let active = this.get('layout.active')
      this.set('layout.active', !active)
    }
  }
});
