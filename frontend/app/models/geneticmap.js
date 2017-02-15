import Ember from 'ember';
import DS from 'ember-data';
import Model from 'ember-data/model';
import attr from 'ember-data/attr';
import { fragmentArray } from 'model-fragments/attributes';
import { PartialModel, partial } from 'ember-data-partial-model/utils/model';
// const { attr } = DS;

export default PartialModel.extend({
  name: attr('string'),

  extended: partial('geneticmap', 'extended', {
    chromosomes: DS.hasMany('chromosome', { async: false })
  }),

  extraMaps: [],
  isSelected: false,

  linkTo: Ember.computed('name', function() {
    return [this.get("id")];
  }),

  mapDeleteLink: Ember.computed('extraMaps', function() {
    let exMaps = this.get("extraMaps");
    let that = this;
    return exMaps.filter(function(mapid) { return mapid != that.get("id"); });
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
