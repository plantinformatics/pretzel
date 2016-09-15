import Ember from 'ember';
import DS from 'ember-data';

export default DS.Model.extend({
  name: DS.attr('string'),
  markers: DS.attr('marker'),
  extraMaps: [],
  linkTo: Ember.computed('name', function() {
    return [this.get("id")];
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
