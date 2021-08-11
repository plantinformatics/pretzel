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
      } else if (d3.event.ctrlKey) {
        syntenyBlockAdjust.apply(this, [d, i, g]);
      } else {
        syntenyBlockEdit.apply(this, [d, i, g]);
      };
    });
}

function getSelectedElements() {
  return stacks?.oa?.selectedElements;
}
function showStyleEditor(show) {
    stacks?.oa?.eventBus && stacks.oa.eventBus.set('showStyleEditor', show);
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
  let selectedElements = getSelectedElements();
  if (selectedElements && Array.isArray(selectedElements)) {
    selectedElements.splice(0);
    selectedElements.push(this);
    showStyleEditor(true);
  }
}
/** Add this element to selectedElements, if it is not already present,
 * and apply the currently-chosen colour.
 */
function syntenyBlockSelect(d, i, g) {
  let selectedElements = getSelectedElements();
  if (selectedElements) {
    selectedElements.addObject(this);
    selectedElements.get('applyColour')();
  }
}
/** Add this element to selectedElements, if it is not already present.
 * Show the style-editor
 */
function syntenyBlockAdjust(d, i, g) {
  let selectedElements = getSelectedElements();
  if (selectedElements) {
    selectedElements.addObject(this);
    showStyleEditor(true);
  }
}


/*----------------------------------------------------------------------------*/


/*----------------------------------------------------------------------------*/
export { configureSyntenyBlockClicks, syntenyBlockEdit, syntenyBlockSelect };
