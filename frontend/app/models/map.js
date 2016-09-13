import Ember from 'ember';
import DS from 'ember-data';

export default DS.Model.extend({
  name: DS.attr('string'),
  markers: DS.attr('marker'),
  extraMaps: [],
  mapLink: Ember.computed('extraMaps', function() {
    console.log("in map model:");
    console.log(this.get('extraMaps'));
    var retlist = this.get("extraMaps");
    if (retlist == null) {
      return this.get("id");
    }
    else {
      console.log("in map model retlist");
      console.log(retlist);
      retlist.push(this.get("id"));
      return retlist;
    }
  })

});
