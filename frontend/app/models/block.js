import Ember from 'ember';
import DS from 'ember-data';
import attr from 'ember-data/attr';
// import { PartialModel, partial } from 'ember-data-partial-model/utils/model';

export default DS.Model.extend({
  datasetId: DS.belongsTo('dataset'),
  annotations: DS.hasMany('annotation', { async: false }),
  intervals: DS.hasMany('interval', { async: false }),
  features: DS.hasMany('feature', { async: false }),
  range: attr('array'),
  scope: attr('string'),
  name: attr('string'),
  featureType: attr('string'),

  extraBlocks: [],

  isSelected: false,

  linkTo: Ember.computed('name', function() {
    return [this.get("id")];
  }),

  blockDeleteLink: Ember.computed('extraBlocks', function() {
    let exChrs = this.get("extraBlocks");
    let that = this;
    // console.log("blockDeleteLink", this.get('name'), this.get('id'), exChrs);
    return exChrs.filter(function(chrid) {
      return chrid != that.get("id");
    });
  }),

  blockLink: Ember.computed('extraBlocks', function() {
    var retlist = this.get("extraBlocks");
    // console.log("blockLink", this.get('name'), this.get('id'), retlist);
    if (retlist == null) {
      return [this.get("id")];
    }
    else {
      retlist.push(this.get("id"));
      return retlist;
    }
  })
});
