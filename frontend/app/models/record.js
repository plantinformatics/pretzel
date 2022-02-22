import { computed } from '@ember/object';
import { inject as service } from '@ember/service';
import Model, { attr } from '@ember-data/model';
import { readOnly } from '@ember/object/computed';

const dLog = console.debug;

export default Model.extend({
  session: service('session'),
  apiServers : service(),

  clientId: attr('string'),
  groupId: attr('string'),
  public: attr('boolean'),
  readOnly: attr('boolean'),
  createdAt: attr("date"),
  updatedAt: attr("date"),

  // ---------------------------------------------------------------------------

  /** @return true if .clientId matches the session .authenticated.clientId
   */
  owner: computed('clientId', function() {
    let server = this.get('apiServers').lookupServerName(this.store.name),
    /** clientId for the server which this record is from */
    clientIdRecord = server && server.clientId;
    /** this is the clientId for the primaryServer; same as clientIdRecord only if the record is not from a secondary. */
    let clientIdSession = this.get('session.data.authenticated.clientId')
    let clientId = this.get('clientId')
    return clientId && (clientIdRecord === clientId);
  }),

  /** @return true if .groupId is a group of the session .authenticated.clientId
   */
  groupOwner: computed('clientId', function() {
    let server = this.get('apiServers').lookupServerName(this.store.name),
    /** clientId for the server which this record is from */
    clientIdRecord = server && server.clientId;
    let clientId = this.get('clientId');
    let groupId = this.get('groupId');
    let ok = ! groupId;
    if (groupId) {
      ok = clientId.get('groups').findBy('id', groupId.id);
      dLog('groupOwner', ok, groupId, clientId, this.id);
    }
    return ok;
  }),

  editable: computed('owner', 'readOnly', function() {
    return this.get('owner') || !this.get('readOnly')
  })
});
