import EntryBase from './entry-base';


export default EntryBase.extend({


  /*--------------------------------------------------------------------------*/
  actions : {
    loadBlock(block) {
      this.sendAction('loadBlock', block);
    }
  } // actions
  /*--------------------------------------------------------------------------*/


});
