import Ember from 'ember';
import { computed } from '@ember/object';

import { stacks  } from '../../utils/stacks';

const FileName = "components/axis-menu";
const dLog = console.debug;

export default Ember.Component.extend({

  classNames: ['axis-menu'],

  menuActions : computed.alias('axisApi.menuActions'),

  actions: {
    onHide : function () {
      dLog(FileName, ': onHide');
      let axes1d = this.parentView;
      axes1d.set('menuAxis', undefined);
    },

    deleteMap : function() {
      console.log("deleteMap in ", FileName);
      this.menuActions.axisDelete();
    },
    flipAxis : function() {
      console.log("flipAxis in ", FileName);
      this.menuActions.axisFlip();
    },
    perpendicularAxis : function() {
      console.log("perpendicularAxis in ", FileName);
      this.menuActions.axisPerpendicular();
    },
    extendMap : function() {
      console.log("extendMap in ", FileName);
      this.menuActions.axisExtend();
    },


    blockVisible : function() {
      console.log("blockVisible in ", FileName);
      this.blockVisible();
    },

  },

  x() {
    /** blockId of reference block of axis, from axes1d.menuAxis */
    let axis = this.get('axis')
  }

});

