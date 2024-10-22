import { stacks } from '../../utils/stacks';

/* global d3 */

/*----------------------------------------------------------------------------*/

const dLog = console.debug;

/** shift-click and ctrl-click can be used to make a selection of a group of graphic elements  */
const enableModifiers = false;

/*----------------------------------------------------------------------------*/

function configureSyntenyBlockClicks(selection) {
  selection
    .on('click', function (event, d) {
      if (enableModifiers && event.shiftKey) {
        syntenyBlockSelect.apply(this, [d]);
      } else if (enableModifiers && event.ctrlKey) {
        syntenyBlockAdjust.apply(this, [d]);
      } else {
        let selectedElements = getSelectedElements();
        if (selectedElements && (selectedElements.get('selectOrApply') === 'apply')) {
          syntenyBlockApply.apply(this, [d]);
        } else {
          if (enableModifiers) {
            syntenyBlockEdit.apply(this, [d]);
          }
        }
      };
    });
}

function getSelectedElements() {
  return stacks?.oa?.selectedElements;
}

/** Store this element in selectedElements[], the array of elements
 * which are the scope of components/draw/style-editor, after clearing
 * the array.
 *
 * Called via d3 on <path> .syntenyEdge :
 *   .on('click', syntenyBlockEdit)
 */
function syntenyBlockEdit(d) {
  /** not decided yet whether selectedElements will be 1 per draw-map or singleton. */
  let selectedElements = getSelectedElements();
  if (selectedElements && Array.isArray(selectedElements)) {
    selectedElements.clear();
    selectedElements.push(this);
  }
}
/** Add this element to selectedElements, if it is not already present,
 * and apply the currently-chosen colour.
 * As in syntenyBlockAdjust(), if it is present, remove it;  i.e. toggle its selectedness.
 * Also : if removing this element, remove other elements on the same block-adj;
 * this is analogous to shift-click de/selecting neighbouring elements.
 */
function syntenyBlockSelect(d) {
  let selectedElements = getSelectedElements();
  if (selectedElements) {
    if (selectedElements.includes(this)) {
      removeElementsOfBlockAdj(selectedElements, this);
      d3.select(this)
        .style('fill', undefined)
        .style('stroke', undefined);
    } else {
      // could use Array.from(...).mapBy('__data__') then filter by elementsSameBlockAdj();
      let siblingElements = [];
      this.parentElement.childNodes.forEach((e) => {
        if (elementsSameBlockAdj([e, this])) {
          siblingElements.push(e);
        } } );
      selectedElements.addObjects(siblingElements);
      // selectedElements.get('applyColour')();
    }
  }
}
/** Remove from selectedElements elements which have the same blockIds as elt.
 */
function removeElementsOfBlockAdj(selectedElements, elt) {
  let siblingElements = selectedElements.filter((e) => elementsSameBlockAdj([e, elt]));
  selectedElements.removeObjects(siblingElements);
}
/** @return true if the 2 given elements are in the same block-adj,
 * i.e. their blockIds match
 */
function elementsSameBlockAdj(e) {
  let 
  same,
  d = e.mapBy('__data__'),
  /** d[*][0] and [1] are the blockIds; other elements won't match. */
  i = d[0].indexOf(d[1][0]);
  if (i !== -1) {
    // i is 0 or 1, 1-i is 1 or 0.
    same = d[0][1-i] === d[1][1];
    console.log(same, i, d[0][1-i], d[1][1]);
  }
  return same;
}

/** Add this element to selectedElements, if it is not already present.
 * If it is present, remove it;  i.e. toggle its selectedness.
 */
function syntenyBlockAdjust(d) {
  let selectedElements = getSelectedElements();
  if (selectedElements) {
    if (selectedElements.includes(this)) {
      selectedElements.removeObject(this);
      d3.select(this)
        .style('fill', undefined)
        .style('stroke', undefined);
    } else {
      selectedElements.addObject(this);
    }
  }
}
function syntenyBlockApply(d) {
  let selectedElements = getSelectedElements();
  if (selectedElements) {
    selectedElements.get('applyColour')(this);
  }
}




/*----------------------------------------------------------------------------*/


/*----------------------------------------------------------------------------*/
export { configureSyntenyBlockClicks, syntenyBlockEdit, syntenyBlockSelect };
