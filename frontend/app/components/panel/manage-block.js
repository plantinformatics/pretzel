import Ember from 'ember';

export default Ember.Component.extend({
  newTag: '',
  newInterval: '',
  actions: {
    // alter publicity boolean on particular record type
    flipPublic: function(record) {
      console.log('FLIPPUBLIC', record)
      let visible = record.get('public')
      record.set('public', !visible)
      record.save()
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
  // determine if interval can be created according to conditions
  disableCreateInterval: Ember.computed('newInterval', 'block.intervals', function() {
    let block = this.get('block')
    let newInterval = block.get('newInterval')
    console.log('newInterval', this.newInterval, this.newInterval.length)
    if (this.newTag.length < 1) {
      return true
    } else if (newInterval) {
      return newInterval.indexOf(this.newInterval) > -1
    } else {
      return false
    }
  }),
  // display potential interval from selectedFeatures, if valid
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
