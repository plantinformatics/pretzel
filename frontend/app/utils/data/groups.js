import { inject as service } from '@ember/service';
import EmberObject, { computed } from '@ember/object';
import { later } from '@ember/runloop';
import { A } from '@ember/array';

/* global Promise */

//------------------------------------------------------------------------------

import { toArrayPromiseProxy } from '../ember-devel';
import { getGroups, clientGroupsToGroups } from './group';

// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------

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
  /** Combine the groups from groupsIn and groupsOwn, de-duplicated,
   * and prefixed with noGroup.
   * This is used in 2 pull-down lists (manage-dataset.js and manage-explorer.js),
   * allowing the user to select either none, or any of the groups they are in or own.
   */
  @computed('groupsIn', 'groupsOwn')
  get groupsInOwnNone() {
    /** factored from manage-dataset.js : groupsPromise() */
    const
    fnName = 'groupsInOwnNone',
    ownP = this.get('groupsOwn'),
    inP = this.get('groupsIn')
      .then(clientGroupsToGroups),
    apiResultP = Promise.all([ownP, inP])
      .then((as) => A(as[0].slice()).addObjects(as[1]));

    let
    groupsP = apiResultP.then((gs) => {
      gs.unshift(noGroup);
      dLog(fnName, 'gs', gs);
      return gs;
    });
    return groupsP;
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
    /** getDatasets() does not delay on getVersion(), and getGroups2() is
     * required before getDatasets() so that dataset groupId.owner evaluates correctly.
     * So either delay getDatasets() until getVersion() is done, or simply
     * assume version is OK (there are no current servers older than apiVersion 2)
     */
    groupsP = Promise.resolve(2)/*server.getVersion()*/.then((apiVersion) => {
      // if (apiVersion >= 2)
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
    const fnName = 'saveGroupInIds';
    let groupIds = gi.toArray()
        .mapBy('groupId.id');
    if (groupIds) {
      this.set('groupsInIds', groupIds);
      dLog(fnName, groupIds);
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

// -----------------------------------------------------------------------------

/** select-group.hbs uses .id and .name.
 *  manage-dataset.js : datasetChangeGroup() uses .get('id')
 */
const noGroup = EmberObject.create({id : 'noGroup', name : ''});

// -----------------------------------------------------------------------------

export {
  noGroup
}

// -----------------------------------------------------------------------------
