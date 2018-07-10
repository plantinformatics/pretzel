import Ember from 'ember';
const { inject: { service } } = Ember;

import { flowsServiceInject, flowButtonsSel, configurejQueryTooltip, flows_showControls, updateSelections_flowControls  } from "../../utils/draw/flow-controls";

/* global d3 */

export default Ember.Component.extend({
  flowsService: service('data/flows-collate'),

classNames: ['col-xs-12'],

  init() {
    // trigger flowsService to be injected into utils/draw/flow-controls before didRender() calls that library.
    let flowsService = this.get('flowsService');
    // this is done by flows-collate init(), but that occurs later
    flowsServiceInject(flowsService);
    console.log('components/draw/flow-controls init', arguments);
    this._super.apply(this, arguments);
  },
  didRender() {
    console.log('flow-controls didRender');
    // @see flows_showControls() ->  updateSelections();		+	split out the flow.g update, and trigger it from here
    updateSelections_flowControls();
    let flowsService = this.get('flowsService');
    flowsService.flowConfig.viewOptions = this.get('viewOptions');
  }

});
