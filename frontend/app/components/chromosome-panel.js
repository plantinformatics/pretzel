import Ember from 'ember';

export default Ember.Component.extend({
  actions: {
    addNewTag: function() {
      let new_tag = this.get('newTag')
      let chr = this.get('chr')
      if (new_tag) {
        let new_tags = chr.get('tags') || []
        new_tags.push(new_tag)
        chr.set('tags', new_tags)
        chr.save()
      }
    }
  }
});
