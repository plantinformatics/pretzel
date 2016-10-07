import DS from 'ember-data';

export default DS.RESTAdapter.extend({
  host: 'http://localhost:1776',
  namespace: 'api/v1'
});

