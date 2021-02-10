
/* global Ember */

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
import $ from 'jquery';

/** If true, show the popover over the element which is hovered.
 * If false, show the popover at the top-right corner of the graph area.
 */
const hoverNearElement = false;

/**

 * usage e.g. (from axis-tracks)
 * function  configureTrackHover(interval)
 * {
 *   return configureHover.apply(this, [interval.description]);
 * }
 * ... d3.each(configureTrackHover);
 */
function configureHover(context, textFn)
{
  d3.select(this).on('mouseover', showHover.bind(this, context, textFn));
  d3.select(this).on('mouseout', hideHover.bind(this));
}

function showHover(context, textFn, d) {
  // console.log("configureHover", location, this, this.outerHTML);
  let text = textFn(context, d);

  /** jQuery selection of target element to display popover near.
   * if hoverNearElement then node_ is also the source element which originates the hover.
   */
  let node_ = hoverNearElement ? $(this) : $('#popoverTarget');
  if (node_.popover) {
    /** refn : node_modules/bootstrap/js/popover.js */
    let data    = node_.data('bs.popover');
    if (data) {
      /* this seems to follow the doc, but doesn't change .content
      node_
        .popover('show')
        .popover({content : text}); */
      node_.data('bs.popover').options .content = text;
    } else {
      /** https://getbootstrap.com/docs/3.4/javascript/#popovers */
      let options = {
        trigger : "manual",	// was : click hover
        sticky: true,
        delay: {show: 200, hide: 3000},
        container: 'div#holder',
        placement : hoverNearElement ? "auto right" : "left",
        content : text
      };
      if (! hoverNearElement) {
        // same as default, with arrow removed : <div class="arrow"></div>
        options.template = '<div class="popover" role="tooltip"> <h3 class="popover-title"></h3><div class="popover-content"></div></div>';
        // ? options.modifiers = { arrow : {enabled : false}};
      }
      node_
        .popover(options);
    }
    node_.popover('show');
  }
}
function hideHover() {
  /** jQuery selection of target element to display popover near. */
  let node_ = hoverNearElement ? $(this) : $('#popoverTarget');
  node_.popover('hide');
}



function configureHorizTickHover(d, block, hoverTextFn) {
  // console.log("configureHorizTickHover", d, this, this.outerHTML);
  let text = hoverTextFn(d, block);
  let node_ = this;
  if ($(node_).popover)
  $(node_)
    .popover({
      trigger : "click hover",
      sticky: true,
      delay: {show: 200, hide: 3000},
      container: 'div#holder',
      placement : "auto right",
      positionFixed : true,
      // comment re. title versus content in @see draw-map.js: configureHorizTickHover() 
      content : text,
      html: false
    });
}
/*------------------------------------------------------------------------*/

export { configureHover, configureHorizTickHover };
