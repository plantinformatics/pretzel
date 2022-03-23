import Route from '@ember/routing/route';
import { action } from '@ember/object';

// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------

export default class GroupEditRoute extends Route {

  @action
  willTransition(transition) {
    dLog('willTransition', transition);
    this.controller.set('selectedClientGroupId', null);
    this.controller.set('deleteGroupMsg', null);
  }

  @action
  refreshModel() {
    this.refresh();
  }

}
