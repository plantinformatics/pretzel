import Ember from 'ember';

const { inject: { service }, Component } = Ember;

export default Component.extend({
  apiEndpoints: service('api-endpoints'),

    addEmpty : function () {
      this.get('apiEndpoints').addEndpoint(undefined, undefined, undefined);
      console.log('addEmpty', this);
    },


  actions: {
    addEmpty : function () {
      console.log('action addEmpty', this);
      this.addEmpty();
    },
    addNewDatasource() {
      $('#new-datasource-modal').modal('show');
    }
  },

  endpoints : Ember.computed('apiEndpoints.endpoints.@each', function () {
    let endpoints = this.get('apiEndpoints.endpoints');
    console.log('endpoints', endpoints, this);
    return endpoints;
  })

});
