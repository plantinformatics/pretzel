import Model, { attr, belongsTo, hasMany } from '@ember-data/model';
import { computed } from '@ember/object';
import { inject as service } from '@ember/service';

// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------


/*
export default class GroupModel extends Model {

  @attr('string') name;

}
*/


export default Model.extend({
  apiServers : service(),

  name : attr('string'),
  /** true means group members can add datasets to this group. */
  writable : attr('boolean'),

  /** creator / owner / admin of the group */
  // @belongsTo('client') clientId;
  clientId : belongsTo('client', {async: true, inverse: null/*'groupsOwn'*/}),
  /** members of the group */
  clients: hasMany('client', {async: false, inverse: null/*'groups'*/}),
  clientGroups: hasMany('client-group', { async: false, inverse: 'groupId'}),

  // ---------------------------------------------------------------------------

  get isVisible() {
    let
    clientGroups = this.get('clientGroups'),
    visibleByCG = clientGroups?.findBy('isVisible'),
    visible = !! visibleByCG;
    if (clientGroups) {
      dLog('isVisible', visible, this.name, clientGroups.mapBy('id'), clientGroups.mapBy('isVisible'));
    }
    return visible;
  },


  // ---------------------------------------------------------------------------

  /** server() and owner() are copied from record.js; server() is also factored
   * from controllers/group.js; there is some overlap between group and record,
   * but group is distinct from dataset / annotation / interval.
   */

  server : computed( function () {
    let
    serverName = this.store.name,
    server = serverName && this.get('apiServers').lookupServerName(serverName);
    // dLog('server', server, serverName, this);
    return server;
  }),

  /** @return true if .clientId matches the authenticated session clientId of
   * the server of this group.
   */
  owner: computed('clientId', function() {
    let
    server = this.get('server'),
    /** clientId for the server which this record is from */
    clientIdRecord = server?.clientId,
    /** server.clientId is hex string of db id; this.clientId is Proxy of client object.  */
    clientId = this.get('clientId.id'),
    isOwner = clientId && (clientIdRecord === clientId);
    return isOwner;
  }),


  // ---------------------------------------------------------------------------

});

