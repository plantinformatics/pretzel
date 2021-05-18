import { computed } from '@ember/object';
import { inject as service } from '@ember/service';
import Model, { attr } from '@ember-data/model';
import { readOnly } from '@ember/object/computed';

export default Model.extend({
  session: service('session'),
  apiServers : service(),

  clientId: attr('string'),
  public: attr('boolean'),
  readOnly: attr('boolean'),
  createdAt: attr("date"),
  updatedAt: attr("date"),

  owner: computed('clientId', function() {
    let server = this.get('apiServers').lookupServerName(this.store.name),
    /** clientId for the server which this record is from */
    clientIdRecord = server && server.clientId;
    /** this is the clientId for the primaryServer; same as clientIdRecord only if the record is not from a secondary. */
    let clientIdSession = this.get('session.data.authenticated.clientId')
    let clientId = this.get('clientId')
    return clientId && (clientIdRecord === clientId);
  }),
  editable: computed('owner', 'readOnly', function() {
    return this.get('owner') || !this.get('readOnly')
  })
});
