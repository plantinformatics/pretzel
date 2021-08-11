import Component from '@ember/component';
import { computed, observer } from '@ember/object';
import { inject as service } from '@ember/service';

import SpectrumColorPickerComponent from 'ember-spectrum-color-picker/components/spectrum-color-picker';

/* global d3 */

import { stacks } from '../../utils/stacks';

/*----------------------------------------------------------------------------*/

const dLog = console.debug;

/*----------------------------------------------------------------------------*/

function getSelectedElements() {
  return stacks?.oa?.selectedElements;
}
function showStyleEditor(show) {
    stacks?.oa?.eventBus && stacks.oa.eventBus.set('showStyleEditor', show);
}

/*----------------------------------------------------------------------------*/

export default Component.extend({

  enableSetFill : true,
  enableSetStroke : true,

  elementColour: computed({
    get() {
      let selectedElements = getSelectedElements();
      let elements = selectedElements;
      // could use an arrayObserver, or pass an action ...
      selectedElements.set('applyColour', () => this.applyColour(this.currentColour));
      let colour = elements.length && window.getComputedStyle(elements[0])['stroke'];
      return colour;
    },
    set(key, colour) {
      // key is "elementColour"
      this.applyColour(colour);
      this.set('currentColour', colour);
      return colour;
    }
  }),

  /** Apply the given colour to the selectedElements,
   * as enabled by enableSet{Fill,Stroke}
   */
  applyColour(colour) {
      let selectedElements = getSelectedElements();
      let elements = selectedElements;
      dLog('set', colour, elements.length);
      /* use .style instead of .attr to apply fill/stroke so that they
       * are not overridden by CSS rules for path.syntenyEdge : fill, stroke.
       * refn https://www.w3.org/TR/SVG/styling.html#PresentationAttributes
       * https://stackoverflow.com/questions/47088409/svg-attributes-beaten-by-cssstyle-in-priority/47088443#47088443
       */
      let elementsS = d3.selectAll(elements);
      if (this.get('enableSetFill')) {
        elementsS
        .style('fill', colour);
      }
      if (this.get('enableSetStroke')) {
        elementsS
        .style('stroke', colour);
      }
      showStyleEditor(false);

  }


});
