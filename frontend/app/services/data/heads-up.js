import Service, { inject as service } from '@ember/service';


const dLog = console.debug;

export default Service.extend({

  /** information such as a tool-tip which may come from any component,
   * about user action options, e.g. when hovered over the axis g.tick text, the
   * tip will indicate ctrl-click on text can drag the axis.
   * Displayed in a fixed location, so that the user can expect this type of
   * guidance in that location.
   *
   * This utils/hover.js : configureHover() is similar, but in that case the
   * tool-tip might optionally be preferred as a popover near the hovered
   * element instead of at a fixed location.
   */
  tipText : undefined

  /*--------------------------------------------------------------------------*/

});
