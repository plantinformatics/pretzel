import { stacks } from '../../utils/stacks';

/* global d3 */

/*----------------------------------------------------------------------------*/

const dLog = console.debug;


/*----------------------------------------------------------------------------*/

function configureSyntenyBlockClicks(selection) {
  selection
    .on('click', function (d, i, g) {
      if (d3.event.shiftKey) {
        syntenyBlockSelect.apply(this, [d, i, g]);
      } else {
        syntenyBlockEdit.apply(this, [d, i, g]);
      };
    });
}

/** Store this element in selectedElements[], the array of elements
 * which are the scope of components/draw/style-editor, after clearing
 * the array.
 *
 * Called via d3 on <path> .syntenyEdge :
 *   .on('click', syntenyBlockEdit)
 */
function syntenyBlockEdit(d, i, g) {
  /** not decided yet whether selectedElements will be 1 per draw-map or singleton. */
  let selectedElements = stacks?.oa?.selectedElements;
  if (selectedElements && Array.isArray(selectedElements)) {
    selectedElements.splice(0);
    selectedElements.push(this);
    stacks?.oa?.eventBus && stacks.oa.eventBus.set('showStyleEditor', true);
  }
}
function syntenyBlockSelect(d, i, g) {
  let selectedElements = stacks?.oa?.selectedElements;
  if (selectedElements) {
    selectedElements.push(this);
  }
}

/*----------------------------------------------------------------------------*/


/*----------------------------------------------------------------------------*/
export { configureSyntenyBlockClicks, syntenyBlockEdit, syntenyBlockSelect };
