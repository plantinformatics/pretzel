import { inject as service } from '@ember/service';
import EmberObject, { computed } from '@ember/object';
import { later } from '@ember/runloop';

import { toArrayPromiseProxy } from '../ember-devel';
import { getGroups } from './group';

/** For each api-server, provide access to the groups/in,own APIs
 *
 * When groupsIn,Own are evaluated, the APIs will be called if there is not a
 * cached value, or .refresh() has signalled .refreshSignal
 *
 * @param server  components/service/api-server.js
 */
export default class DataGroups extends EmberObject {
  @service auth;
  @service apiServers;

  constructor() {
    super();
    this.refreshSignal = 0;
  }
  /** Signal that the groupsIn,Own properties should be refreshed when next evaluated */
  refresh() {
    this.incrementProperty('refreshSignal');
  }

  /** groupsIn and groupsOwn are attributes of the logged-in user, so they could
   * be attributes of model/client, but since the app is refreshed by
   * logout/login these values can be provided by this service.
   * Update can be requested after local or remote group / membership change,
   * (remote change can be indicated by a refresh button in the first instance).
   */
  @computed('refreshSignal')
  get groupsIn() {
    const own = false;
    let promise = this.getGroups(own);
    promise.then((gi) => later(() => this.saveGroupInIds(gi), 2000));
    return promise;
  }
  @computed('refreshSignal')
  get groupsOwn() {
    const own = true;
    return this.getGroups(own);
  }

  /** Check server.apiVersion < 2, then if OK call getGroups2(own)
   * I.e. this handles server.getVersionP being pending, whereas getGroups2()
   * expects that apiVersion has been received or is assigned its default value.
   * @return promise yielding array of groups (own) or client-groups + groups (in),
   * wrapped with toArrayPromiseProxy() because model.groups{Own,In} are used in
   * .hbs (could alternately use helper (to-array-promise-proxy ) in .hbs).
   */
  getGroups(own) {
    let
    server = this.server,
    groupsP = server.getVersion().then((apiVersion) => {
      return this.getGroups2(apiVersion, own); });
    return toArrayPromiseProxy(groupsP);
  }
  /**
   * @param apiVersion  server.apiVersion, which may be default (1)
   * @param own true for groups/own, false for groups/in (or equivalent)
   * @return promise, yielding [] if the server.apiVersion precedes groups/ APIs
   */
  getGroups2(apiVersion, own) {
    let groupsP;
    if (! apiVersion || (apiVersion < 2)) {
      groupsP = Promise.resolve([]);
    } else {
      let
      /**   @service session;
            clientId = this.get('session.session.authenticated.clientId'),
      */
      store = this.server.store,
      auth = this.get('auth'),
      apiServers = this.get('apiServers');
      groupsP = getGroups(auth, own, this.server, apiServers);
    }
    return groupsP;
  }

  /** extract the groupIds from the groups/in result
   */
  saveGroupInIds(gi) {
    let groupIds = gi.toArray()
        .mapBy('_internalModel._relationshipProxyCache.groupId.content.id');
    if (groupIds) {
      this.set('groupsInIds', groupIds);
    }
  }

  /** @return true if the logged-in user is in the given groupId.
   * if groups/in result is not received, return false.
   */
  inGroup(groupId) {
    let
    groupIds = this.get('groupsInIds'),
    g = groupIds && groupIds.includes(groupId);
    return !! g;
  }

}
