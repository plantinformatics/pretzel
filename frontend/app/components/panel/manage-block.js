import Record from './manage-record';

export default Record.extend({
  newAnnotation: '',
  newInterval: '',
  actions: {
    addAnnotation: function() {
      console.log('ADD ANNOTATION')
      // let duplicate = this.get('duplicateTag')
      // if (!duplicate) {
      let newAnnotation = this.get('newAnnotation')
      let block = this.get('block')
      let blockId = block.get('id')
      let store = this.get('store')
      if (newAnnotation) {
        console.log('NEW ANNOTATION', newAnnotation)
        console.log('block id', block.get('id'))
        var annotation = store.createRecord('annotation', {
          name: newAnnotation,
          blockId: block
        });

        console.log('ANNOTATION', annotation)
        // newAnnotations.push(newAnnotation)
        // block.set('tags', newAnnotations)
        annotation.save()
      }
      this.set('newAnnotation', '')
      // }
    },
    addInterval: function() {
      let duplicate = this.get('duplicateInterval')
      if (!duplicate) {
        let new_tag = this.get('newAnnotation')
        let block = this.get('block')
        if (new_tag) {
          let new_tags = block.get('tags') || []
          new_tags.push(new_tag)
          block.set('tags', new_tags)
          block.save()
        }
        this.set('newAnnotation', '')
      }
    }
  },
  dataset: Ember.computed('block', function() {
    let block = this.get('block')
    console.log('BLOCK', block)
    // let datasetId = block.get('datasetId')
    let dataset = block.get('map')
    return dataset
  }),
  disableCreateTag: Ember.computed('newAnnotation', 'block.annotations', function() {
    let block = this.get('block')
    let tags = block.get('tags')
    console.log('newAnnotation', this.newAnnotation, this.newAnnotation.length)
    if (this.newAnnotation.length < 1) {
      return true
    } else if (tags) {
      return tags.indexOf(this.newAnnotation) > -1
    } else {
      return false
    }
  }),
  // determine if interval can be created according to conditions
  disableCreateInterval: Ember.computed('newInterval', 'block.intervals', function() {
    let block = this.get('block')
    let newInterval = block.get('newInterval')
    console.log('newInterval', this.newInterval, this.newInterval.length)
    if (this.newInterval.length < 1) {
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
