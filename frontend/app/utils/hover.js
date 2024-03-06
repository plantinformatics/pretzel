import { stacks } from './stacks';

/* global Ember */
/* global d3 */

// -----------------------------------------------------------------------------

const dLog = console.debug;

const trace = 0;

/*------------------------------------------------------------------------*/
/* copied from draw-map.js - will import when that is split */
/* also @see configurejQueryTooltip() */

/*
 * usage e.g. components/draw/axis-1d.js.
 * This could probably also be used for axis-tracks.js : configureTrackHover()
 */

/** Setup hover info text over scaffold horizTick-s.
 * @see based on axis-tracks : configureHorizTickHover;
 * related : configureAxisTitleMenu()
 */
//------------------------------------------------------------------------------

import $ from 'jquery';

let
config = {
  /** If true, show the popover over the element which is hovered.
   * If false, show the popover at the top-right corner of the graph area.
   *  : urlOptions && urlOptions.hoverNearElement
   */
  hoverNearElement : false,
  container : 'div#holder',
  popoverTarget : '#popoverTarget',
};
function hoverConfigure(hoverNearElement, container, popoverTarget) {
  config.hoverNearElement = hoverNearElement;
  config.container = container;
  config.popoverTarget = popoverTarget;
}



/** Set up an element hover (mouseover) event to display text.
 * @param context client data
 * @param textFn  given the context and hovered element datum, create text to show in the hover popover.
 * called with d3 signature : textFn.apply(this, [context, d, i, g])
 * If result starts with <div or <span, set options.html.
 *
 * Usage e.g. (from axis-tracks)
 * function  configureTrackHover(interval)
 * {
 *   return configureHover.apply(this, [interval.description, hoverTextFn]);
 * }
 * ... d3.each(configureTrackHover);
 */
function configureHover(context, textFn)
{
  d3.select(this).on('mouseover', showHover.bind(this, context, textFn));
  d3.select(this).on('mouseout', hideHover.bind(this));
}

function showHover(context, textFn, d, i, g) {
  // console.log("configureHover", location, this, this.outerHTML);
  let text = textFn.apply(this, [context, d, i, g]);
  let isHtml = text.startsWith('<div') || text.startsWith('<span');
  const hoverNearElement = config.hoverNearElement;

  /** jQuery selection of target element to display popover near.
   * if hoverNearElement then node_ is also the source element which originates the hover.
   */
  let node_ = hoverNearElement ? $(this) : $(config.popoverTarget);
  if (node_.popover) {
    /** refn : node_modules/bootstrap/js/popover.js */
    let data    = node_.data('bs.popover');
    if (data) {
      /* this seems to follow the doc, but doesn't change .content
      node_
        .popover('show')
        .popover({content : text});
       * .config was .options in earlier version (bootstrap3)
       */
      let options = data.config;
      options.content = text;
      options.html = isHtml;
      data.config.visible = true;
      data.show();
    } else {
      /** https://getbootstrap.com/docs/3.4/javascript/#popovers */
      let options = {
        trigger : "manual",	// was : click hover
        sticky: true,
        delay: {show: 200, hide: 3000},
        container: config.container,
        placement : hoverNearElement ? "auto right" : "left",
        // comment re. title versus content in @see draw-map.js: configureHorizTickHover() 
        content : text
      };
      if (isHtml) {
        options.html = isHtml;
      }
      if (! hoverNearElement) {
        // same as default, with arrow removed : <div class="arrow"></div>
        options.template = '<div class="popover no-border" role="tooltip"> <h3 class="popover-title"></h3><div class="popover-content"></div></div>';
        // ? options.modifiers = { arrow : {enabled : false}};
      }
      node_
        .popover(options);
      if (trace) {
        dLog('showHover', text, context, textFn, d, i, g, node_.data('bs.popover'), node_.data('bs.popover').options);
      }
    }
    // node_.popover('show');
  }
}
function hideHover() {
  /** jQuery selection of target element to display popover near. */
  let node_ = config.hoverNearElement ? $(this) : $(config.popoverTarget);
  // for devel, comment this out to enable styling of popover in Web Inspector
  node_.popover('hide');
  const data = node_.data('bs.popover');
  if (data) {
    data.config.visible = true;
    data.hide();
  }

  if (trace) {
    dLog('hideHover', node_);
  }
}


/** Wrapper for configureHover(), supporting existing uses in
 * utils/draw/chart1.js : ChartLine.prototype.{bars,linebars}
 */
function configureHorizTickHover(d, block, hoverTextFn) {
  // console.log("configureHorizTickHover", d, this, this.outerHTML);
  /** client data : block for hoverTextFn() */
  let context = {block};
  configureHover.apply(this, [context, (context_, d) => hoverTextFn(d, context_.block)]);
}
/* The original of this function configureHorizTickHover (up to 3e674205) is
 * very similar to draw-map : configureHorizTickHover() which was factored from.
 * Using configureHover() is equivalent, minor differences :
 * this version had positionFixed : true, and html: false,
 * and configureHover() adds hoverNearElement ... "left".
   */

/*----------------------------------------------------------------------------*/

/** Setup hover info text over scaffold horizTick-s.
 * Based on similar @see configureAxisTitleMenu()
 * @desc These are being factored to utils/hover.js :
 * @see configureHover, configureHorizTickHover
 */
function  configureHorizTickHover_orig(location)
{
  console.log("configureHorizTickHover", location, this, this.outerHTML);
  /** typeof location may also be "number" or "object" - array : syntenyBlocks[x] */
  let text = (location == "string") ? location :  "" + location;
  let node_ = this;
  if ($(node_).popover)
  $(node_)
    .popover({
      trigger : "click hover",
      sticky: true,
      delay: {show: 200, hide: 3000},
      container: 'div#holder',
      placement : "auto right",
      /* The popover placement is 65px too high (might depend on window size).
       * As a simple fix, offset was tried with no apparent effect, possibly
       * depends on a recent version.  An alternative would be to use a
       * placement function.
       * offset : "0 65px",
       */
      /* Could show location in content or title; better in content because
       * when content is undefined a small content area is still displayed,
       * whereas undefined title takes no visual space.
       * title : location,
       */
       content : text
    });
}


//------------------------------------------------------------------------------

export {
  hoverConfigure,
  configureHover, configureHorizTickHover,
  configureHorizTickHover_orig,
};
