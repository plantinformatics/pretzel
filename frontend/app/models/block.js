import Ember from 'ember';
import DS from 'ember-data';
import attr from 'ember-data/attr';
// import { PartialModel, partial } from 'ember-data-partial-model/utils/model';

import Record from './record';

export default Record.extend({
  datasetId: attr('string'), // TODO update
  annotations: DS.hasMany('annotation', { async: false }),
  intervals: DS.hasMany('interval', { async: false }),
  features: DS.hasMany('feature', { async: false }),

  extraChrs: [],
  isSelected: false,

  linkTo: Ember.computed('name', function() {
    return [this.get("id")];
  }),

  chrDeleteLink: Ember.computed('extraChrs', function() {
    let exChrs = this.get("extraChrs");
    let that = this;
    // console.log("chrDeleteLink", this.get('name'), this.get('id'), exChrs);
    return exChrs.filter(function(chrid) {
      return chrid != that.get("id");
    });
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
