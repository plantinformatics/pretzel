import Ember from 'ember';
import { computed } from '@ember/object';
import { next as run_next } from '@ember/runloop';
import { htmlSafe } from '@ember/template';

import { stacks  } from '../../utils/stacks';

const FileName = "components/axis-menu";
const dLog = console.debug;

/** if true, close menu after action buttons are clicked. */
const closeAfterAction = false;

/**
 * @param blockS	reference block of axis, from axes1d.menuAxis
 * @param axisApi	axisApi.menuActions defines the actions for the axis menu buttons
 */
export default Ember.Component.extend({

  classNames: ['axis-menu'],

  /** the parameter will likely change from blockS (stacks) to block. */
  block : computed.alias('blockS.block'),
  /** blockId of blockS */
  axisName : computed.alias('blockS.axisName'),
  menuActions : computed.alias('axisApi.menuActions'),

  hide() {
    let axes1d = this.parentView;
    dLog('hide', axes1d.menuAxis);
    axes1d.set('menuAxis', undefined);
  },
  actions: {
    onHide : function () {
      dLog(FileName, ': onHide');
      this.hide();
    },

    /** button actions : axis / block : */
    /** axis actions */

    deleteMap : function() {
      console.log("deleteMap in ", FileName);
      this.menuActions.axisDelete(this.axisName);
      this.hide();
    },
    flipAxis : function() {
      console.log("flipAxis in ", FileName);
      this.menuActions.axisFlip(this.axisName);
      if (closeAfterAction)
        this.hide();
    },
    perpendicularAxis : function() {
      console.log("perpendicularAxis in ", FileName);
      this.menuActions.axisPerpendicular(this.axisName);
      if (closeAfterAction)
        this.hide();
    },
    extendMap : function() {
      console.log("extendMap in ", FileName);
      this.menuActions.axisExtend(this.axisName);
      if (closeAfterAction)
        this.hide();
    },
  },

  /** block actions */

  blockUnview : function(blockS) {
    console.log("blockUnview in ", FileName);
    this.menuActions.blockUnview(blockS);
    if (closeAfterAction)
        this.hide();
  },

  blockVisible : function(blockS) {
    console.log("blockVisible in ", FileName);
    this.menuActions.blockVisible(blockS);
    if (closeAfterAction)
        this.hide();
  },


  /** @return array of Blocks (i.e. stacks.js references)
   */
  dataBlocks : computed(
    'block',
    'block.viewedChildBlocks.[]',
    'block.blockService.viewedBlocksByReferenceAndScopeUpdateCount',
    function () {
      let
      dataBlocks;
      /** close menu when axis is removed, i.e. this.block is un-viewed. */
      if (! this.block.isViewed || ! this.block.axis) {
        dLog('dataBlocks', this.block.isViewed, this.block.axis, this.block);
        /** wait until next cycle of run loop because this CP is called during render. */
        run_next(() => this.hide());
        /* returning undefined is also OK, result is used in axis-menu.hbs : #each dataBlocks */
        dataBlocks = [];
      } else {
        /** skip the reference block, which is shown above the data block list.
         * This can change to use stacks-view:axesBlocks().
         */
        dataBlocks = this.block.axis.blocks.slice(1);
      }
      return dataBlocks;
    }),
  dataBlockText(blockS) {
      let
      block = blockS.block,
      /** block.name is generally just .scope, which is the same for all blocks
       * in the axis, so it is displayed just on the first line (reference
       * block).
       */
      title = block
        ? (block.get('datasetId.name') || block.get('namespace')) // + ' : ' + block.get('name')
        : blockS.longName();
      return title;
    },
  dataBlockColour(blockS) {
    let
    block = blockS.block,
    axis1d = this.block.axis1d,
    colour = axis1d.blockColourValue(block);
    return colour;
  },
  dataBlockColourStyle(blockS) {
    let
    colour = this.dataBlockColour(blockS),
    style = htmlSafe('color: ' + colour);
    return style;
  },
  /**
   * based on : utils/stacks.js : Block:titleText(), without the leading ' : ' + 
   */
  dataBlockFeatureCountsText(blockS) {
    let
    block = blockS.block,
    featureCount = block && block.get('featureCount'),
    featureCountLoaded = block.get('featuresLength'),
    featureCountText = (featureCount || featureCountLoaded) ? featureCountLoaded + ' / ' + featureCount : '';
    return featureCountText;
  },

});

