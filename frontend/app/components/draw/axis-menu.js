import Ember from 'ember';
import { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import { next as run_next, later } from '@ember/runloop';
import { inject as service } from '@ember/service';
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
  apiServers : service(),
  controls : service(),
  controlsView : alias('controls.controls.view'),


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


  /** if true then display input for this.block.datasetId._meta.shortName */
  editShortName : false,

  /** When the user edits .shortName, display only that and not the chromosome
   * (block) scope / name.
   */
  editedShortName() {
    let referenceBlock = this.get('blockS.block'),
        axisTitleShow = referenceBlock.get('axisTitleShow');
    dLog('editedShortName', axisTitleShow);
    axisTitleShow.setProperties({
      'name' : true,
      'scope' : false});
  },

  // ---------------------------------------------------------------------------



  /** @return array of Blocks (i.e. stacks.js references)
   */
  dataBlocks : computed(
    'block',
    'block.viewedChildBlocks.[]',
    'block.blockService.viewedBlocksByReferenceAndScopeUpdateCount',
    'block.axis1d.dataBlocks',
    function () {
      let
      dataBlocks,
      axis1d;
      /** close menu when axis is removed, i.e. this.block is un-viewed. */
      if (! this.block.isViewed) {
        dLog('dataBlocks', this.block.isViewed, this.block.axis, this.block);
        /** wait until next cycle of run loop because this CP is called during render. */
        run_next(() => this.hide());
        /* returning undefined is also OK, result is used in axis-menu.hbs : #each dataBlocks */
        dataBlocks = [];
      } else if ((axis1d = this.block.axis1d)) {
        /* axis1d.dataBlocks returns ember data model objects, so map that to
         * Stacks Blocks, until Stacks Blocks are absorbed into axis-1d and
         * dataBlocks() can return model objects instead. */
        dataBlocks = axis1d.dataBlocks
          .map((b) => b.view);
      } else if (this.block.axis) {
        /** skip the reference block, which is shown above the data block list,
         * if it is not a data block.  A GM (Genetic Map) is the first block of
         * its axis and it is data.
         *
         * This can change to use stacks-view:axesBlocks().
         */
        let
        axisBlocks = this.block.axis.blocks,
        firstIsData = axisBlocks[0].block.isData;
        dataBlocks = axisBlocks.slice(firstIsData ? 0 : 1);
      }
      else {
        dataBlocks = [];
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
    axis1d = this.block.axis1d ||
      blockS.axis?.axis1d ||
      block.get('view.axis.axis1d'),
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

  // ---------------------------------------------------------------------------

  // using extracts (multipleServers and lookupServerName) from utils/draw/axisTitleBlocksServers_tspan.js : AxisTitleBlocksServers.prototype.render()
  multipleServers : computed('apiServers.serversLength', function () {
    return this.apiServers.get('serversLength') > 1;
  }),

  dataBlockServerColour(blockS) {
    let
    block = blockS.block,
    colour = this.apiServers.lookupServerName(block.store.name).get('colour');
    return colour;
  },
  dataBlockServerColourStyle(blockS) {
    let
    colour = this.dataBlockServerColour(blockS),
    style = htmlSafe('color: ' + colour);
    return style;
  },

  // ---------------------------------------------------------------------------

  xOffsetsEffect : computed('xOffsetsChangeCount', function () {
    dLog('xOffsetsEffect', this.get('xOffsetsChangeCount'));
    let tooltip = this.get('popoverTooltip');
    if (tooltip) {
      later(() => {
        tooltip.hide();
        tooltip.show();
      });
    }
  }),

  /** from the value of popover in .hbs <EmberPopover ...   as |popover| >,
   * get the value of popover._tooltip.
   */
  get popoverTooltip () {
    /** only 1 child, so expect that this.get('childViews.0._debugContainerKey') === "component:ember-popover" */ 
    let tooltip = this.get('childViews.0._tooltip');
    return tooltip;
  },


  // ---------------------------------------------------------------------------

});

