import Component from '@glimmer/component';
import { computed, get } from '@ember/object';
import { alias } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import { htmlSafe } from '@ember/template';

const dLog = console.debug;

export default class PanelSelectedServerComponent extends Component {
  @service controls;
  @alias('controls.apiServerSelectedOrPrimary') apiServerSelectedOrPrimary;

  // @alias('controls.serverTabSelected') serverTabSelected;
  // @service apiServers;

  @alias('apiServerSelectedOrPrimary') apiServer;

  /**
   * based on panel/api-server-tab.js : borderStyle().
  */
  @computed('apiServer.name')
  get borderStyle() {
    let apiServerColour = get(this, 'apiServer').get('colour'),
    style = 'border-color:' + apiServerColour;
    dLog('borderStyle', apiServerColour, this.apiServerName);
    return htmlSafe(style);
  }

}
