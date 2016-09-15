import Ember from 'ember';
import DS from 'ember-data';

export default DS.Model.extend({
  name: DS.attr('string'),
  extraMaps: [],
  linkTo: Ember.computed('name', function() {
    return [this.get("id")];
  }),
  isSelected: Ember.computed('extraMaps', function() {
    // Return true if this mapset has already been selected;
    // in other words, if it is contained in the extraMaps array.
    if (this.get("extraMaps").indexOf(this.get("id")) != -1) {
      return true;
    }
    return false;
  }),
  mapLink: Ember.computed('extraMaps', function() {
    var retlist = this.get("extraMaps");
    if (retlist == null) {
      return [this.get("id")];
    }
    else {
      retlist.push(this.get("id"));
      return retlist;
    }
  })

});
