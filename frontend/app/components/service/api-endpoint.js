import Ember from 'ember';

const { Component } = Ember;

/*----------------------------------------------------------------------------*/


/** Convert punctuation, including whitespace, to _  */
function removePunctuation(text) {
  // a normal input will contain e.g. :/@\.
  return text && text.replace(/[^A-Za-z0-9]/g, '_');
};


/** ApiEndpoint (components/service/api-endpoint)
 *
 * It is expected that values for the fields .host and .name are passed as
 * attributes of the create() options.
 *
 * Fields :
 *  .host URL of API host
 *  .user email of user account on that host
 *  .token  after login on that host, this is the authorization token;
 *
 */
export default Ember.Object.extend({
  init() {
    this._super(...arguments);
  },

  /**  sanitize user input */
  name : Ember.computed('host', function () {
    let host = this.get('host'),
    name = removePunctuation(this.host);
    console.log('ApiEndpoint', this.host, this.user, this.token);
    return name;
  }),

  /** Used by manage-explorer.js: endpointTabId()
   * for unique IDs of tab DOM elements.
   */
  tabId : Ember.computed('name',  function() {
    let name = this.get('name'),
    id = name && name.replace(/^https?_+/, '');
    console.log('tabId', id, this);
    return id;
  }),

  /** value is an array of datasets, including blocks, returned from the api host. */
  datasetsBlocks : undefined,
  
  actions: {

      }

});

export { removePunctuation };
