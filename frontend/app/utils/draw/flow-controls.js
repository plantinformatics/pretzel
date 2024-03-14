import $ from 'jquery';
import { inject as service } from '@ember/service';


/*----------------------------------------------------------------------------*/

import { mmaa2text } from "./collate-paths";
import { Flow } from "../flows";

let flowsService; // = service('data/flows-collate');
function flowsServiceInject(flowsService_) { flowsService = flowsService_; }


/*----------------------------------------------------------------------------*/

/*global d3 */

const dLog = console.debug;

/*----------------------------------------------------------------------------*/

// copied from components/draw-map.js
/** Used for d3 attributes whose value is the datum. */
function I(d) { /* console.log(this, d); */ return d; }

/*----------------------------------------------------------------------------*/

// moved here from components/draw-map.js

/** this selector is the same as the selector in styles/app.css, i.e. maintain them in sync. */
let flowButtonsSel = "div.drawing-controls.flowButtons";

/*----------------------------------------------------------------------------*/

function configurejQueryTooltip(node) {
  d3.selectAll(node + " div.flowButton")
    .each(function (flowName) {
      // console.log("configurejQueryTooltip", flowName, this, this.outerHTML);
      let node_ = this;
      if ($(node_).popover)
      $(node_)
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
}

/*----------------------------------------------------------------------------*/

function flow_names(flows)
{
  let result = [];
  for (let f in flows)
    result.push(f);
  return result;
}

/**
 * @param parentSelector is flowButtonsSel
 */
function flows_showControls (parentSelector)
{
  let flows = flowsService.get('enabledFlows');
  let parent = d3.select(parentSelector);
  /** maintain order. */
  let flowNames = flow_names(flows);

  function flowSelected(flowName)
  {
    let flow = flows[flowName],
    visible = flow && flow.visible;
    return visible;
  }
  function flowDescription(flowName)
  {
    let flow = flows[flowName],
    description = (flow && flow.description) || flowName;
    return description;
  }

  /** button to toggle flow visibilty. */
  let b = parent.selectAll("ul > li")
    .data(flowNames)
    .selectAll("div.flowButton")
    .data(function (d) { return [d]; })
    .enter()
    .append("div");
  if (! b.empty())
    console.log('flows_showControls', b.nodes(), b.node());
  b
    .attr("class",  function (flowName) { return flowName;})
    .classed("flowButton", true)
    .classed("selected", flowSelected)
    .on('click', function (event, flowName) {
      console.log(flowName, event);
      // sharing click with Export menu
      if (event.shiftKey)
        return;
      // toggle visibilty
      let flow = flows[flowName];
      console.log('flow click', flow);
      flow.setVisible(! flow.visible);
      let b1=d3.select(this);
      b1.classed("selected", flow.visible);
      // updateSelections_flowControls();
      flow.g.classed("hidden", ! flow.visible);
      flow.gf.classed("hidden", ! flow.visible);
      console.log(flow.g.node(), flow.gf.node());
    })
  /* To get the hover text, it is sufficient to add attr title.
   * jQuery doc (https://jqueryui.com/tooltip/) indicates .tooltip() need
   * only be called once per document, perhaps that is already done by
   * d3 / jQuery / bootstrap.
   */
    .attr("title", flowDescription)
    .attr("data-id", function (flowName) {
      return "Export:" + flowName;
    })
  ;

}

/*----------------------------------------------------------------------------*/

/** In the event of flow-controls.hbs being re-rendered,
 * this function is used to update d3 selections :
 * flows[*].g
 * Also @see draw-map.js:updateSelections(), from which this was split.
 */
function updateSelections_flowControls() {
  let flows = flowsService.get('enabledFlows');
  // let parent = d3.select(flowButtonsSel);
  let foreground = d3.select('#holder svg > g > g.foreground');
  /** parent of flow <g>s, for [frontend, progress] */
  let flowPg = [foreground, foreground.select('g > g.progress')];
  Object.keys(flows).forEach(function (flowName) {
    let flow = flows[flowName];
    [false, true].forEach((progress) => {
      /** separate <g> for paths loaded via paths-progressive from backend API (g).
       * or via collate-paths (frontend) (gf).
       */
      let gName = progress ? 'g' : 'gf',
      flow_g = flow[gName];
      if (flow_g)
        console.log(flowName, " flow_g", flow_g.node());
      flow[gName] = flowPg.select("g:not(.progress) > g." + flow.name);
      dLog(flowName, progress, gName, " flow_g", flow_g.node());
    });
  });

}


/*----------------------------------------------------------------------------*/

Flow.prototype.ExportDataToDiv = function (eltSel)
{
  let elts = $(eltSel);
  if (! elts.length)
  {
    window.alert("Show the Adv tab in the right panel before Export\n(and scroll down).");
  }
  else
  {
    let elt = elts[0];
  // or for text : elt.append()
  elt.innerHTML =
    "<div><h5>" + this.name + "</h5> : " + this.pathData.length + "</div>\n";
  this.pathData.forEach(function (ffaa) {
    let s = "<div>" + mmaa2text(ffaa) + "</div>\n";
    elt.insertAdjacentHTML('beforeend', s);
  });
  }
};


/*----------------------------------------------------------------------------*/

export { flowsServiceInject, flowButtonsSel, configurejQueryTooltip, flows_showControls, updateSelections_flowControls };
