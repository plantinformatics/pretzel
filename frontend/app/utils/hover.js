/*------------------------------------------------------------------------*/
/* copied from draw-map.js - will import when that is split */
/* also @see configurejQueryTooltip() */

/*
 * usage e.g. components/draw/axis-1d.js.
 * This could probably also be used for axis-tracks.js : configureTrackHover()
 */

/** Setup hover info text over scaffold horizTick-s.
 * @see based on similar configureAxisTitleMenu()
 */
function  configureHorizTickHover(d, block, hoverTextFn)
{
  // console.log("configureHorizTickHover", d, this, this.outerHTML);
  let text = hoverTextFn(d, block);
  let node_ = this;
  Ember.$(node_)
    .popover({
      trigger : "click hover",
      sticky: true,
      delay: {show: 200, hide: 3000},
      container: 'div#holder',
      placement : "auto right",
      // comment re. title versus content in @see draw-map.js: configureHorizTickHover() 
      content : text,
      html: false
    });
}
/*------------------------------------------------------------------------*/

export { configureHorizTickHover };
