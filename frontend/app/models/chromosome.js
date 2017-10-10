import DS from 'ember-data';
import attr from 'ember-data/attr';
import { PartialModel, partial } from 'ember-data-partial-model/utils/model';

export default DS.Model.extend({
  name: attr('string'),
  // id: attr('string'),
  geneticmapId: attr('string'),
  //extended: partial('chromosome', 'extended', {
  markers: DS.hasMany('marker', { async: false }),
  //}),

  extraChrs: [],
  isSelected: false,

  linkTo: Ember.computed('name', function() {
    return [this.get("id")];
  }),

  chrDeleteLink: Ember.computed('extraChrs', function() {
    let exChrs = this.get("extraChrs");
    let that = this;
    // console.log("chrDeleteLink", this.get('name'), this.get('id'), exChrs);
    return exChrs.filter(function(chrid) { return chrid != that.get("id"); });
  }),

  chrLink: Ember.computed('extraChrs', function() {
    var retlist = this.get("extraChrs");
    // console.log("chrLink", this.get('name'), this.get('id'), retlist);
    if (retlist == null) {
      return [this.get("id")];
    }
    else {
      retlist.push(this.get("id"));
      return retlist;
    }
  })
});
