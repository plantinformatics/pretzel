import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { alias } from '@ember/object/computed';

// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------

export default class FormSelectServerComponent extends Component {
  @service() apiServers;
  @alias('apiServers.servers') servers;


  /**
   * @param serverName  server.tabId (not .name)
   */
  @action
  selectedServerChangedName(serverName) {
    const fnName = 'selectedServerChangedName';
    dLog(fnName, this, serverName, this._debugContainerKey, arguments);
    let
    apiServers = this.apiServers,
    server = apiServers.lookupServerTabId(serverName);
    dLog(fnName, serverName, server);
    this.args.selectedServerChanged(server);
    return server;
  }


}
