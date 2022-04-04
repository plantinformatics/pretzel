import { inject as service } from '@ember/service';
import EmberObject, { computed } from '@ember/object';

import { toArrayPromiseProxy } from '../ember-devel';
import { getGroups } from './group';

/**
 * @param server  components/service/api-server.js
 */
export default class DataGroups extends EmberObject {
  @service auth;

  constructor() {
    super();
    this.refreshSignal = 0;
  }
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
    return this.getGroups(own);
  }
  @computed('refreshSignal')
  get groupsOwn() {
    const own = true;
    return this.getGroups(own);
  }

  getGroups(own) {
    let
    /**   @service session;
    clientId = this.get('session.session.authenticated.clientId'),
    */
    store = this.server.store,
    auth = this.get('auth'),
    groupsP = toArrayPromiseProxy(getGroups(auth, own, this.server));
    return groupsP;
  }

}
