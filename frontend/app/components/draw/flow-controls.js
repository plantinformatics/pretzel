import { computed } from '@ember/object';
import Component from '@ember/component';
import { inject as service } from '@ember/service';

import {
  flowsServiceInject,
  flowButtonsSel,
  configurejQueryTooltip,
  flows_showControls,
  updateSelections_flowControls
} from "../../utils/draw/flow-controls";
import { Flow } from "../../utils/flows";
import { parseOptions } from '../../utils/common/strings';


/* global d3 */

export default Component.extend({
  flowsService: service('data/flows-collate'),

  tagName : '',
  classNames: ['panel-section'],

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
    this._super.apply(this, arguments);
    // trigger flowsService to be injected into utils/draw/flow-controls before didRender() calls that library.
    let flowsService = this.get('flowsService');
    // this is done by flows-collate init(), but that occurs later
    flowsServiceInject(flowsService);

    console.log('components/draw/flow-controls init', arguments);
  },
  willRender() {
    this._super.apply(this, arguments);
    let flowsService = this.get('flowsService');
    let options = this.get('parsedOptions'),
    uAlias = options && options.uAlias;
    console.log('willRender', options, uAlias, flowsService.flowConfig);
    if ((uAlias != undefined) && (flowsService.flowConfig.uAlias != uAlias))
    {
      flowsService.flowConfig.uAlias = uAlias;
      if (uAlias)
      {
        let flows = this.get('flowsService.flows');
        if (flows.alias.title == "Aliases")
        {
          flows.alias.title += ' (non-unique)';
          flows.alias.description =
            flows.alias.description
            .replace(/by aliases /, 'by non-unique aliases');
        }
      }
    }
  },
  didRender() {
    this._super.apply(this, arguments);

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
    let
      options = this.get('parsedOptions');
      if (options && options.flowExport)
        configurejQueryTooltip(flowButtonsSel);
  },
  parsedOptions : computed('modelParamOptions', function () {
    let options, //  = this.get('parsedOptions'),
    options_param;
    if (/*! options
        &&*/ (options_param = this.get('modelParamOptions'))
        && (options = parseOptions(options_param)))
    {
      console.log('parsedOptions', options);
    }
    return options;
  }),
  showVisible(flow) {
    {
      // was clicked element `this` 
      let b1=d3.select(flowButtonsSel + ' .flowButton.' + flow.name);
      console.log(b1.nodes(), b1.node(), flow.visible);
      b1.classed("selected", flow.visible);
    }
    console.log('showVisible', flow, flow.g.node(), flow.g.node());
    // updateSelections_flowControls();
    flow.g.classed("hidden", ! flow.visible);
    flow.gf.classed("hidden", ! flow.visible);
  }
  

});
