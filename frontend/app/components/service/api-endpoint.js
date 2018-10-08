import Ember from 'ember';

const { Component } = Ember;

/*----------------------------------------------------------------------------*/

/**
 * @param url host URL
 */
function ApiEndpoint(url, user, token) {
  console.log('ApiEndpoint', url, user, token);
  this.host = url;
  this.user = user;
  // -	also sanitize user input
  this.name = url
    ? this.host_safe()
    : "New";
  this.token = token;
}

/** Convert punctuation, including whitespace, to _  */
function removePunctuation(text) {
  // a normal input will contain e.g. :/@\.
  return text && text.replace(/[^A-Za-z0-9]/g, '_');
};
ApiEndpoint.prototype.host_safe = function() {
  return removePunctuation(this.host);
};
ApiEndpoint.prototype.user_safe = function() {
  return removePunctuation(this.user);
};
/** Used by manage-explorer.js: endpointTabId()
 */
ApiEndpoint.prototype.tabId = function() {
  let id = this.host_safe().replace(/^https?_+/, '');
  console.log('tabId', id, this);
  return id;
};


/** ApiEndpoint (components/service/api-endpoint)
 * Wraps ApiEndpoint Base above
 */
export default Ember.Object.extend({
  init() {
    this._super(...arguments);
  },

  /** value is an array of datasets, including blocks, returned from the api host. */
  datasetsBlocks : undefined,
  
  actions: {

      }

});

export { removePunctuation, ApiEndpoint };
