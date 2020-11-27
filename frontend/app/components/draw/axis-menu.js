import Ember from 'ember';
import { computed } from '@ember/object';

import { stacks  } from '../../utils/stacks';

const FileName = "components/axis-menu";
const dLog = console.debug;

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

  actions: {
    onHide : function () {
      dLog(FileName, ': onHide');
      let axes1d = this.parentView;
      axes1d.set('menuAxis', undefined);
    },

    deleteMap : function() {
      console.log("deleteMap in ", FileName);
      this.menuActions.axisDelete(this.axisName);
    },
    flipAxis : function() {
      console.log("flipAxis in ", FileName);
      this.menuActions.axisFlip(this.axisName);
    },
    perpendicularAxis : function() {
      console.log("perpendicularAxis in ", FileName);
      this.menuActions.axisPerpendicular(this.axisName);
    },
    extendMap : function() {
      console.log("extendMap in ", FileName);
      this.menuActions.axisExtend(this.axisName);
    },


    blockVisible : function() {
      console.log("blockVisible in ", FileName);
      this.blockVisible();
    },

  },

  dataBlockTexts : computed('block', function () {
    let
    /** skip the reference block, which is shown above the data block list.  */
    dataBlocks = this.block.axis.blocks.slice(1),
    texts = dataBlocks.map((blockS) => {
      let
      block = blockS.block,
      /** block.name is generally just .scope, which is the same for all blocks
       * in the axis, so it is displayed just on the first line (reference
       * block).
       */
      title = block
        ? (block.get('namespace') || block.get('datasetId.name')) // + ' : ' + block.get('name')
        : blockS.longName();
      return title;
    });
    return texts;
  })

});

