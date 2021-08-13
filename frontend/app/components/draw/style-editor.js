import Component from '@ember/component';
import { computed, observer } from '@ember/object';
import { alias } from '@ember/object/computed';
import { inject as service } from '@ember/service';

import SpectrumColorPickerComponent from 'ember-spectrum-color-picker/components/spectrum-color-picker';

/* global d3 */

import { stacks } from '../../utils/stacks';

/*----------------------------------------------------------------------------*/

const dLog = console.debug;


/*----------------------------------------------------------------------------*/

export default Component.extend({

  classNames: ['style-editor'],

  enableSetFill : true,
  enableSetStroke : true,

  selectOrApply : 'select',
  /** @param thisStyleEditor === this
   * @param value radio-button value
   */
  changedClick(thisStyleEditor, value) { this.set('selectedElements.selectOrApply', value); },

  selectedElements : alias('stacks.oa.selectedElements'),
  stacks,
  selectedElementsLength : computed('selectedElements.[]', function () {
    return this.get('selectedElements.length');
  }),

  elementColour: computed({
    get() {
      let selectedElements = this.get('selectedElements');
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
      let selectedElements = this.get('selectedElements');
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
  },

  clearSelectedElements() {
    let selectedElements = this.get('selectedElements');
    selectedElements.clear();
  }

});
