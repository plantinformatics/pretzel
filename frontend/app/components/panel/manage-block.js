import ManageBase from './manage-base';
import interval from '../../models/interval';

export default ManageBase.extend({
  newAnnotation: '',
  newInterval: '',
  actions: {
    addAnnotation: function() {
      // console.log('ADD ANNOTATION')
      let newAnnotation = this.get('newAnnotation')
      let block = this.get('block')
      let store = this.get('store')
      if (newAnnotation) {
        var annotation = store.createRecord('annotation', {
          name: newAnnotation,
          blockId: block
        });
        annotation.save()
      }
      this.set('newAnnotation', '')
      // }
    },
    addInterval: function() {
      let newInterval = this.get('newInterval')
      let intervalSelected = this.get('intervalSelected')
      let block = this.get('block')
      let store = this.get('store')
      if (newInterval) {
        let payload = {
          name: newInterval,
          blockId: block
        }
        let starting = intervalSelected.start
        let ending = intervalSelected.end
        // TODO update property references when chart amended
        let positions = [starting.Position, ending.Position]
        let features = [starting.Marker, ending.Marker]
        payload.positions = positions
        payload.features = features
        var annotation = store.createRecord('interval', payload);
        annotation.save()
      }
      this.set('newInterval', '')
    }
  },
  dataset: Ember.computed('block', function() {
    let block = this.get('block')
    // console.log('BLOCK', block)
    // let datasetId = block.get('datasetId')
    let dataset = block.get('map')
    return dataset
  }),
  disableCreateTag: Ember.computed('newAnnotation', 'block.annotations', function() {
    let block = this.get('block')
    let tags = block.get('tags')
    // console.log('newAnnotation', this.newAnnotation, this.newAnnotation.length)
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
    // console.log('newInterval', this.newInterval, this.newInterval.length)
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
      let blockId = block.id;
      selectedFeatures = selectedFeatures.filter(function(feature) {
        // TODO prop requires updating from charting files first
        return feature.Chromosome == blockId
      })
      selectedFeatures = selectedFeatures.sort(function (a, b) {
        return a.Position - b.Position;
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
