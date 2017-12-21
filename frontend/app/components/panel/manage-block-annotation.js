import Ember from 'ember';

const { Component } = Ember;

export default Component.extend({
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
    addTag: function() {
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
    removeTag: function(index) {
      let block = this.get('block')
      let tags = block.get('tags')
      tags.splice(index, 1)
      block.set('tags', tags)
      block.save()
    },
    selectAnnotation(interval) {
      this.sendAction('selectAnnotation', chr);
    },
    deleteInterval(interval) {
      console.log('DELETE INTERVAL')
      // console.log(this.interval)
      console.log(interval)
      console.log(interval.id)

      interval.deleteRecord()
      console.log('DELETED RECORD')
      interval.save()
      console.log('SAVE RECORD')
    },
    switchGeneticmap(geneticmap) {
      console.log('switchGeneticmap')
      let active = this.get('layout.active')
      this.set('layout.active', !active)
    }
  }
});
