import Ember from 'ember';
const { inject: { service } } = Ember;

import { flowsServiceInject, flowButtonsSel, configurejQueryTooltip, flows_showControls, updateSelections_flowControls  } from "../../utils/draw/flow-controls";
import { Flow } from "../../utils/flows";
import { parseOptions } from '../../utils/common/strings';


/* global d3 */

export default Ember.Component.extend({
  flowsService: service('data/flows-collate'),

  tagName : '',
  // classNames: ['col-xs-12'],

  actions : {
    toggleVisible : function (flowName, toggle, event) {
      let flows = this.get('flowsService.flows'),
      flow = flows[flowName];
      // event is defined when action is from input checkbox, not from the label
      console.log('toggleVisible', flowName, toggle, flow.visible, event && event.target);
      if (toggle)
        flow.setVisible(!flow.visible);
      this.get('showVisible')(flow);
    }
  },

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
    let flowsService = this.get('flowsService');
    let flows = this.get('flowsService.flows');
    flowsService.flowConfig.viewOptions = this.get('viewOptions');

    this.get('renderColourBlocks').apply(this, []);
    // checkbox has input action toggleVisible();  otherwise showVisible() here.
    if (false)
    {
      // @see flows_showControls() ->  updateSelections();		+	split out the flow.g update, and trigger it from here
      if (! flows['direct'].g)
        updateSelections_flowControls();

      for (let flowName in flows)
        this.get('showVisible')(flows[flowName]);
    }

    let me = this;
    /** using set() because flow.visible is bound in {{input}}; if instead
     * using <input>, then can use : flow.visible = ...
     * @param this is flow
     */
    function flowSetVisible(visible)
    {
      me.set('flowsService.flows.' + this.name + '.visible', visible);
    };
    Flow.prototype.setVisible = flowSetVisible;
  },

  renderColourBlocks() {
    flows_showControls(flowButtonsSel);

    let options = this.get('parsedOptions'),
    options_param;
    if (! options
        && (options_param = this.get('modelParamOptions'))
        && (options = parseOptions(options_param)))
    {
      console.log('renderColourBlocks', options);
      this.set('parsedOptions', options);
      if (options.flowExport)
        configurejQueryTooltip(flowButtonsSel);
    }
  },
  showVisible(flow) {
    {
      // was clicked element `this` 
      let b1=d3.select(flowButtonsSel + ' .flowButton.' + flow.name);
      console.log(b1.nodes(), b1.node(), flow.visible);
      b1.classed("selected", flow.visible);
    }
    console.log('toggleVisible', flow, flow.g.node());
    // updateSelections_flowControls();
    flow.g.classed("hidden", ! flow.visible);
  }
  

});
