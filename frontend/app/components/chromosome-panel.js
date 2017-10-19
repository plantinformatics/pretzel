import Ember from 'ember';

export default Ember.Component.extend({
  chr: Ember.computed('selectedChrom', function() {
    let chrom = this.get('selectedChrom')
    if (chrom) {
      console.log(chrom.get('markers'))
    }
    return chrom;
  }),
  markers: Ember.computed('chr', function() {
    let chr = this.get('chr')
    if (chr) {
      return chr.get('markers')
    }
    return null
  })
});
