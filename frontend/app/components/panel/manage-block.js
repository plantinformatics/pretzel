import Ember from 'ember';

export default Ember.Component.extend({
  newTag: '',
  newInterval: '',
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
    flipPublic: function(record) {
      console.log('FLIPPUBLIC', record)
      // let recordId = record.get('id')
      // let model = 
      let visible = record.get('public')
      record.set('public', !visible)
      record.save()

      // let block = this.get('block')
      // let visible = block.get('public')
      // block.set('public', !visible)
      // block.save()
    },
    removeTag: function(index) {
      let block = this.get('block')
      let tags = block.get('tags')
      tags.splice(index, 1)
      block.set('tags', tags)
      block.save()
    }
  },
  disableCreateTag: Ember.computed('newTag', 'block.tags', function() {
    let block = this.get('block')
    let tags = block.get('tags')
    console.log('newTag', this.newTag, this.newTag.length)
    if (this.newTag.length < 1) {
      return true
    } else if (tags) {
      return tags.indexOf(this.newTag) > -1
    } else {
      return false
    }
  }),
  dataset: Ember.computed('block', function() {
    let block = this.get('block')
    console.log('BLOCK', block)
    // let datasetId = block.get('datasetId')
    let dataset = block.get('map')
    return dataset
  }),
  disableCreateInterval: Ember.computed('newInterval', 'block.intervals', function() {
    let block = this.get('block')
    let newInterval = block.get('newInterval')
    console.log('newInterval', this.newInterval, this.newTag.length)
    if (this.newTag.length < 1) {
      return true
    } else if (newInterval) {
      return newInterval.indexOf(this.newTag) > -1
    } else {
      return false
    }
  }),
  intervalSelected: Ember.computed('block', 'selectedFeatures', function() {
    let block = this.get('block')
    let selectedFeatures = this.get('selectedFeatures')
    if (selectedFeatures) {
      let blockId = block.id
      selectedFeatures = selectedFeatures.filter(function(feature) {
        return feature.Block == blockId
      })
      selectedFeatures = selectedFeatures.sort(function (a, b) {
        return a.position - b.position;
      });
      if (selectedFeatures.length >= 2) {
        let payload = {
          'start': selectedFeatures[0],
          'end': selectedFeatures[selectedFeatures.length - 1]
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
