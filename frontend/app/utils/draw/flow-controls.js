import Ember from 'ember';

const { inject: { service } } = Ember;


/*----------------------------------------------------------------------------*/

import { mmaa2text } from "./collate-paths";
import { Flow } from "../flows";

let flowsService; // = service('data/flows-collate');
function flowsServiceInject(flowsService_) { flowsService = flowsService_; }


/*----------------------------------------------------------------------------*/

/*global d3 */

/*----------------------------------------------------------------------------*/

// copied from components/draw-map.js
    /** Used for d3 attributes whose value is the datum. */
    function I(d) { /* console.log(this, d); */ return d; };


/*----------------------------------------------------------------------------*/

// moved here from components/draw-map.js

let flowButtonsSel = "div.drawing-controls > div.flowButtons";

/*----------------------------------------------------------------------------*/

function configurejQueryTooltip(node) {
  d3.selectAll(node + " > div.flowButton")
    .each(function (flowName) {
      // console.log("configurejQueryTooltip", flowName, this, this.outerHTML);
      let node_ = this;
      Ember.$(node_)
      /*
        .tooltip({
          template: '<div class="tooltip" role="tooltip">'
            + '<div class="tooltip-arrow"></div>'
            + '<div class="tooltip-inner"></div>'
            + '</div>',
          title: "title" + flowName
        })
       */
      /* Either 1. show when shift-click, or 2. when hover
       * For 1, un-comment this on(click) and popover(show), and comment out trigger & sticky.
        .on('click', function (event) {
          console.log(event.originalEvent.type, event.originalEvent.which, event);
          // right-click : event.originalEvent.which === 3
          if (event.originalEvent.shiftKey)
            Ember.$(event.target)
       */
        .popover({
          trigger : "hover",
          sticky: true,
          delay: {show: 200, hide: 3000},
          placement : "auto bottom",
          title : flowName,
          html: true,
          /* Possibly some variation between jQuery function .tooltip() and
           * bootstrap popover (used here) : may take parameter template in
           * place of content.
           * This is using : bower_components/bootstrap/js/popover.js, via bower.json
           */
          content : ""
            + '<button class="ExportFlowData" id="Export:' + flowName + '" href="#">Export</button>'
          /*
           })
           .popover("show")
           ;
           */
        })
        .on("shown.bs.popover", function(event) {
          console.log("shown.bs.popover", "Export", event, event.target);
          let exportButtonS = d3.select("button.ExportFlowData");
          console.log(exportButtonS.empty(), exportButtonS.node());
          exportButtonS
            .on('click', function (buttonElt /*, i, g*/) {
              let flows = flowsService.get('flows');
              console.log("Export", flowName, this);
              let flow = flows[flowName];
              // output flow name and data to div.pathDataTable
              flow.ExportDataToDiv("div.ExportFlowData");
            });
        });
    });
};

/*----------------------------------------------------------------------------*/

    function flows_showControls (parentSelector)
    {
      let flows = flowsService.get('flows');
      let parent = d3.select(parentSelector);
      let flowNames = d3.keys(flows);
      /** button to toggle flow visibilty. */
      let b = parent.selectAll("div.flowButton")
        .data(flowNames)
        .enter().append("div");
      b
        .attr("class",  function (flowName) { return flowName;})
        .classed("flowButton", true)
        .classed("selected", function (flowName) { let flow = flows[flowName]; return flow.visible;})
        .on('click', function (flowName /*, i, g*/) {
          let event = d3.event;
          console.log(flowName, event);
          // sharing click with Export menu
          if (event.shiftKey)
            return;
          // toggle visibilty
          let flow = flows[flowName];
          console.log('flow click', flow);
          flow.visible = ! flow.visible;
          let b1=d3.select(this);
          b1.classed("selected", flow.visible);
          updateSelections_flowControls();
          flow.g.classed("hidden", ! flow.visible);
        })
      /* To get the hover text, it is sufficient to add attr title.
       * jQuery doc (https://jqueryui.com/tooltip/) indicates .tooltip() need
       * only be called once per document, perhaps that is already done by
       * d3 / jQuery / bootstrap.
       */
        .attr("title", I)
        .attr("data-id", function (flowName) {
          return "Export:" + flowName;
        })
      ;

    };

/*----------------------------------------------------------------------------*/

    /** In the event of flow-controls.hbs being re-rendered,
     * this function is used to update d3 selections :
     * flows[*].g
     * Also @see draw-map.js:updateSelections(), from which this was split.
     */
    function updateSelections_flowControls() {
      let flows = flowsService.get('flows');
      let parent = d3.select(flowButtonsSel);
      d3.keys(flows).forEach(function (flowName) {
        let flow = flows[flowName];
        if (flow.g)
        console.log(flowName, " flow.g", flow.g._groups[0][0]);
        flow.g = parent.select("g." + flow.name);
        console.log(flowName, " flow.g", flow.g._groups[0][0]);
      });

    };


/*----------------------------------------------------------------------------*/

    Flow.prototype.ExportDataToDiv = function (eltSel)
    {
      let elts = Ember.$(eltSel), elt = elts[0];
      // or for text : elt.append()
      elt.innerHTML =
        "<div><h5>" + this.name + "</h5> : " + this.pathData.length + "</div>\n";
      this.pathData.forEach(function (ffaa) {
        let s = "<div>" + mmaa2text(ffaa) + "</div>\n";
        elt.insertAdjacentHTML('beforeend', s);
      });
    };


/*----------------------------------------------------------------------------*/

export { flowsServiceInject, flowButtonsSel, configurejQueryTooltip, flows_showControls, updateSelections_flowControls };
