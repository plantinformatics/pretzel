import Ember from 'ember';

const { Service } = Ember;

/*----------------------------------------------------------------------------*/

/**
 * @param url host URL
 */
function ApiEndpoint(url, token) {
    console.log('ApiEndpoint', url, token);
    this.url = url;
    this.token = token;
}


/*----------------------------------------------------------------------------*/

export default Service.extend({
    endpoints : [],
  id2Endpoint : new WeakMap(),
    addEndpoint : function (url, token) {
	let endpoint = new ApiEndpoint(url, token),
	    endpoints = this.get('endpoints');
	endpoints.pushObject(endpoint);
    },
  addId : function(endpoint, id) {
    let map = this.get('id2Endpoint');
    map.set(id, endpoint);
    map.set('current', endpoint);
    return id;
  }
});

/*----------------------------------------------------------------------------*/
