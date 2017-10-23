import Ember from 'ember';

export default Ember.Component.extend({
  newTag: '',
  actions: {
    addTag: function() {
      let duplicate = this.get('duplicateTag')
      if (!duplicate) {
        let new_tag = this.get('newTag')
        let chr = this.get('chr')
        if (new_tag) {
          let new_tags = chr.get('tags') || []
          new_tags.push(new_tag)
          chr.set('tags', new_tags)
          chr.save()
        }
        this.set('newTag', '')
      }
    },
    removeTag: function(index) {
      let chr = this.get('chr')
      let tags = chr.get('tags')
      tags.splice(index, 1)
      chr.set('tags', tags)
      chr.save()
    }
  },
  duplicateTag: Ember.computed('newTag', 'chr.tags', function() {
    let chr = this.get('chr')
    let tags = chr.get('tags')
    if (tags) {
      return tags.indexOf(this.newTag) > -1
    } else {
      return false
    }
  })
});
