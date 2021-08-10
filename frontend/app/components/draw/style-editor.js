import Component from '@ember/component';
import { computed, observer } from '@ember/object';
import { inject as service } from '@ember/service';

import SpectrumColorPickerComponent from 'ember-spectrum-color-picker/components/spectrum-color-picker';

/* global d3 */

import { stacks } from '../../utils/stacks';


const dLog = console.debug;


export default Component.extend({

  elementColour: computed({
    get() {
      let selectedElements = stacks?.oa?.selectedElements;
      let elements = selectedElements;
      let colour = elements.length && window.getComputedStyle(elements[0])['stroke'];
      return colour;
    },

    set(key, colour) {
      let selectedElements = stacks?.oa?.selectedElements;
      let elements = selectedElements;
      dLog('set', key, colour, elements.length);
      d3.selectAll(elements)
        .attr('fill', colour)
        .attr('stroke', colour);

      stacks?.oa?.eventBus && stacks.oa.eventBus.set('showStyleEditor', false);

      return colour;
    }
  })


});
