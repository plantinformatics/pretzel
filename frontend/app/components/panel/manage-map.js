import Ember from 'ember';

export default Ember.Component.extend({
  newTag: '',
  newInterval: '',
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
    flipPublic: function() {
      let chr = this.get('chr')
      let visible = chr.get('public')
      chr.set('public', !visible)
      chr.save()
    },
    removeTag: function(index) {
      let chr = this.get('chr')
      let tags = chr.get('tags')
      tags.splice(index, 1)
      chr.set('tags', tags)
      chr.save()
    }
  },
  disableCreateTag: Ember.computed('newTag', 'chr.tags', function() {
    let chr = this.get('chr')
    let tags = chr.get('tags')
    console.log('newTag', this.newTag, this.newTag.length)
    if (this.newTag.length < 1) {
      return true
    } else if (tags) {
      return tags.indexOf(this.newTag) > -1
    } else {
      return false
    }
  }),
  disableCreateInterval: Ember.computed('newInterval', 'chr.intervals', function() {
    let chr = this.get('chr')
    let newInterval = chr.get('newInterval')
    console.log('newInterval', this.newInterval, this.newTag.length)
    if (this.newTag.length < 1) {
      return true
    } else if (newInterval) {
      return newInterval.indexOf(this.newTag) > -1
    } else {
      return false
    }
  }),
  intervalSelected: Ember.computed('chr', 'selectedMarkers', function() {
    let chr = this.get('chr')
    let selectedMarkers = this.get('selectedMarkers')
    if (selectedMarkers) {
      let chrId = chr.id
      selectedMarkers = selectedMarkers.filter(function(marker) {
        return marker.Chromosome == chrId
      })
      selectedMarkers = selectedMarkers.sort(function (a, b) {
        return a.position - b.position;
      });
      if (selectedMarkers.length >= 2) {
        let payload = {
          'start': selectedMarkers[0],
          'end': selectedMarkers[selectedMarkers.length - 1]
        }
        return payload
      } else {
        return false
      }
    } else {
      return false
    }
  })
});
