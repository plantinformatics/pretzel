import Ember from 'ember';
import DS from 'ember-data';
import Model from 'ember-data/model';
import attr from 'ember-data/attr';
// const { attr } = DS;

export default DS.Model.extend({
  name: attr('string'),
  chromosomes: DS.hasMany('chromosome', { async: false }),
});
