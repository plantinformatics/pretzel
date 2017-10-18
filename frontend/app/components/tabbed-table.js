import Ember from 'ember';

export default Ember.Component.extend({
  classNames: ['tabbed-table-container', 'bordered', 'control-panel'],
  filter: 'all',
  data: Ember.computed('selectedChr', 'selectedMarkers', 'filter', function() {
    let selectedChr = this.get('selectedChr')
    let selectedMarkers = this.get('selectedMarkers')
    let filter = this.get('filter')
    // perform filtering according to selectedChr
    let filtered = selectedMarkers //all
    if (filter == 'chrom' && selectedChr) {
      filtered = selectedMarkers.filter(function(marker) {
        return marker.Chromosome === selectedChr.id
      })
    } else if (filter == 'union') {
      //split by chrom
      let chromosomes = {}
      selectedMarkers.forEach(function(marker) {
        if (!chromosomes[marker.Chromosome]) {
          chromosomes[marker.Chromosome] = {}
        }
        let chrom = chromosomes[marker.Chromosome]
        chrom[marker.Marker] = true
      })
      filtered = selectedMarkers.filter(function(marker) {
        var include = true
        Object.keys(chromosomes).forEach(function(chromId) {
          if (!chromosomes[chromId][marker.Marker]) {
            include = false
          }
        })
        return include
      })
    }
    return filtered
  }),
  actions: {
    changeFilter: function(f) {
      this.set('filter', f)
    }
  }
});
