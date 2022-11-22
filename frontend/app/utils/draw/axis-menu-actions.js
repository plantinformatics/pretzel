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

  function axisDelete (axisName  /*buttonElt, i, g*/) {
    console.log("delete", axisName, this);
    // this overlaps with the latter part of blockIsUnviewed()
    // and can be factored with that.
    let axis = oa.axes[axisName], stack = axis && axis.stack;
    // axes[axisName] is deleted by removeStacked1() 
    let stackID = Stack.removeStacked(axisName);
    const axisApi = oa.axisApi;
    axisApi.deleteAxisfromAxisIDs(axisName);
    let sBlock = oa.stacks.blocks[axisName];
    let block = sBlock.block;
    console.log('sBlock.axis', sBlock.axis);
    sBlock.setAxis(undefined);
    axisBrushZoom.removeBrushExtent(axisName);
    axisApi.removeAxisMaybeStack(axisName, stackID, stack);
    const me = oa.eventBus;
    me.send('removeBlock', axisName);
    // filter axisName out of selectedFeatures and selectedAxes
    axisApi.selectedFeatures_removeAxis(axisName, sBlock?.block?.brushName);
    axisApi.sendUpdatedSelectedFeatures();
  }

  function axisFlip (axisName /*buttonElt , i, g*/) {
    console.log("flip", axisName, this);
    /** Handle the possibility that axisName may have been adopted by
     * another axis after this callback registration. */
    let axis = Stacked.getAxis(axisName),
        ya = oa.y[axisName = axis.axisName], ysa=oa.ys[axisName],
        domain = maybeFlip(ya.domain(), true);
    axis.flipped = ! axis.flipped;
    /** if the axis is brushed, show the brush position updated by flip.
     * Instead of using range (inverted to domain via
     * axisRange2Domain); axisBrushShowSelection() uses
     * axisBrush.brushedDomain (as commented in showResize)
     */
    let range = oa.brushedRegions[axisName];

    if (axis.axis1d)
      axis.axis1d.toggleProperty('flipped');
    ya.domain(domain);
    ysa.domain(domain);

    /* after y domain update, map brushed domain to new position.  */
    if (range) {
      dLog('axisFlip', axisName, range);
      let gBrush = axisBrushSelect(oa.svgContainer, axisName);
      axisBrushZoom.axisBrushShowSelection(axisName, gBrush);
    }

    let t = oa.svgContainer.transition().duration(750);
    axisBrushZoom.axisScaleChanged(axisName, t, true);
  }

  function axisPerpendicular (axisName /*buttonElt , i, g*/) {
    console.log("perpendicular", axisName, this);
    let axis = Stacked.getAxis(axisName);
    axis.perpendicular = ! axis.perpendicular;

    oa.showResize(true, true);
  }

  function axisExtend (axisName /*buttonElt , i, g*/) {
    console.log("extend", axisName, this);
    let axis = Stacked.getAxis(axisName), stack = axis && axis.stack;
    // toggle axis.extended, which is initially undefined.
    axis.extended = ! axis.extended;
    // axisShowExtend(axis, axisName, undefined);
    const me = oa.eventBus;
    me.send('enableAxis2D', axisName, axis.extended);
  }

  //----------------------------------------------------------------------------


    /** un-view the block.  (axis-menu : block) */
    function blockUnview (block) {
      console.log("blockUnview (deleteMap / removeBlock)", block.axisName, this);
      // this will do : block.block.setViewed(false);
      const me = oa.eventBus;
      me.send('removeBlock', block.block);
    }
    /** Toggle the visibility of the block.  (axis-menu : block)
     * Call functions to make corresponding update to display of axis title, selected features, paths.
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
        ab && ab();
      }
      axisApi.sendUpdatedSelectedFeatures();

      axisApi.pathUpdate(undefined);
    }

  //----------------------------------------------------------------------------
  
  return result;
}

//------------------------------------------------------------------------------

export {
  AxisMenuActions,
};
