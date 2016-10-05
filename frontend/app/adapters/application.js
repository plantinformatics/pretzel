import DS from 'ember-data';

export default DS.RESTAdapter.extend({
  host: 'http://localhost:1776',
  //namespace: 'api/v1'
  //host: 'http://dav127.it.csiro.au:1776/api/v1'
  //host: 'http://dav127.it.csiro.au:1776',
  namespace: 'api/v1'
});

