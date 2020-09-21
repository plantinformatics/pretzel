import Ember from 'ember';

import { stacks  } from '../../utils/stacks';

const FileName = "components/axis-menu";

export default Ember.Component.extend({

  classNames: ['axis-menu'],

  actions: {
    deleteMap : function() {
      console.log("deleteMap in ", FileName);
      this.deleteMap();
    },
    flipAxis : function() {
      console.log("flipAxis in ", FileName);
      this.flipAxis();
    },
    perpendicularAxis : function() {
      console.log("perpendicularAxis in ", FileName);
      this.perpendicularAxis();
    },
    extendMap : function() {
      console.log("extendMap in ", FileName);
      this.extendMap();
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

