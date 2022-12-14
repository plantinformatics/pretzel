import {
  Stack,
  Stacked,
  stacks,
} from '../stacks';

import {
  AxisBrushZoom,
} from './axisBrush';

import {
  axisBrushSelect,
} from './axisBrush';

import {
  AxisTitle,
} from './axisTitle';

import { PathDataUtils } from './path-data';

import {
  maybeFlip,
}  from './axis';

import {
  collateStacks,
} from "./collate-paths";

//------------------------------------------------------------------------------

const dLog = console.debug;

//------------------------------------------------------------------------------

function AxisMenuActions(oa) {
  let axisBrushZoom = AxisBrushZoom(oa);

  const result = {
    axisDelete, axisFlip, axisPerpendicular, axisExtend,
    // Block sub-menu
    blockUnview,  blockVisible,
  };

  /** lexical context enclosed by menuActions functions :
   * functions :
   *  deleteAxisfromAxisIDs
   *  removeBrushExtent
   *  removeAxisMaybeStack
   *  selectedFeatures_removeAxis
   *  sendUpdatedSelectedFeatures
   *  maybeFlip
   *  axisScaleChanged
   * variables :
   *  oa
   *  Stacked
   *  me
   */

  function axisDelete (axis1d) {
    const axisName = axis1d.axisName;
    console.log("delete", axisName, this);
    // this overlaps with the latter part of blockIsUnviewed()
    // and can be factored with that.
    let axis = axis1d, stack = axis && axis.stack;
    // draw_orig
    // axes[axisName] is deleted by removeStacked1() 
    let stackID = Stack.removeStacked(axisName);
    const axisApi = oa.axisApi;
    // draw_orig
    axisApi.deleteAxisfromAxisIDs(axisName);
    let sBlock = axis1d.referenceBlock.view;
    let block = axis1d.referenceBlock;
    console.log('sBlock.axis', sBlock.axis);
    sBlock.setAxis(undefined);
    axisBrushZoom.removeBrushExtent(axis1d);
    // draw_orig
    // axisApi.removeAxisMaybeStack(axisName, stackID, stack);
    const me = oa.eventBus;
    me.send('removeBlock', axisName);
    // filter axisName out of selectedFeatures and selectedAxes
    axisApi.selectedFeatures_removeAxis(axisName, sBlock?.block?.brushName);
    axisApi.sendUpdatedSelectedFeatures();
  }

  function axisFlip(axis1d) {
    console.log("flip", axis1d.axisName, this);
    /** Handle the possibility that axisName may have been adopted by
     * another axis after this callback registration. */
    let
        ya = axis1d.y, ysa = axis1d.ys,
        domain = maybeFlip(ya.domain(), true);
    /** same comment applies here as for axis.toggleProperty('extended') in axisExtend(). */
    // axis1d.flipped = ! axis1d.flipped;
    axis1d.toggleProperty('flipped');
    /** if the axis is brushed, show the brush position updated by flip.
     * Instead of using range (inverted to domain via
     * axisRange2Domain); axisBrushShowSelection() uses
     * axisBrush.brushedDomain (as commented in showResize)
     */
    let range = axis1d.brushedRegion;

    ya.domain(domain);
    ysa.domain(domain);

    /* after y domain update, map brushed domain to new position.  */
    if (range) {
      dLog('axisFlip', axis1d.axisName, range);
      let gBrush = axisBrushSelect(oa.svgContainer, axis1d);
      axisBrushZoom.axisBrushShowSelection(axis1d, gBrush);
    }

    let t = oa.svgContainer.transition().duration(750);
    axisBrushZoom.axisScaleChanged(axis1d, t, true);
  }

  function axisPerpendicular(axis1d) {
    console.log("perpendicular", axis1d.axisName, this);
    axis1d.perpendicular = ! axis1d.perpendicular;

    oa.showResize(true, true);
  }

  function axisExtend (axis1d) {
    const axisName = axis1d.axisName;
    console.log("extend", axisName, this);
    let axis = axis1d;
    // toggle axis.extended, which is initially undefined.
    /* toggleProperty() will change undefined to true.
     * .extended values are : undefined, true, false, width; where true indicates
     * the default width, and false indicates 0 width.
     * Using ! does not update CPs which depend on this, whereas
     * toggleProperty() does; ! can be used when axis-1d is converted from
     * Ember.Object to Native Object.
     */
    // axis.extended = ! axis.extended;
    axis.toggleProperty('extended');
    // axisShowExtend(axis, axisName, undefined);
    const me = oa.eventBus;
    me.send('enableAxis2D', axisName, axis.extended);
  }

  //----------------------------------------------------------------------------


    /** un-view the block.  (axis-menu : block)
     * @param BlockAxisView (block-axis-view.js)
     */
    function blockUnview (block) {
      console.log("blockUnview (deleteMap / removeBlock)", block.axisName, this);
      // this will do : block.block.setViewed(false);
      const me = oa.eventBus;
      me.send('removeBlock', block.block);
    }
    /** Toggle the visibility of the block.  (axis-menu : block)
     * Call functions to make corresponding update to display of axis title, selected features, paths.
     * @param BlockAxisView (block-axis-view.js)
     */  
    function blockVisible (block) {
      console.log("blockVisible (VisibleAxis), visible", block.visible, block.longName(), this);
      block.visible = ! block.visible;
      /* copy to Ember Block object, for axis-menu to use as dependency in if. */
      block?.block?.set('visible', block.visible);

      const axisTitle = AxisTitle(stacks.oa);
      axisTitle.updateAxisTitles();
      axisTitle.updateAxisTitleSize(undefined);
      const axisApi = oa.axisApi;
      collateStacks();  // does filterPaths();

      if (! block.visible) {
        axisApi.selectedFeatures_removeBlock(block);
      } else {
        let ab = oa.axisApi?.axisFeatureCirclesBrushed;
        const blockView = block;
        const axis1d = blockView.axis;
        ab && ab(axis1d);
      }
      axisApi.sendUpdatedSelectedFeatures();

      const pathDataUtils = PathDataUtils(oa);
      pathDataUtils.pathUpdate(undefined);
    }

  //----------------------------------------------------------------------------
  
  return result;
}

//------------------------------------------------------------------------------

export {
  AxisMenuActions,
};
