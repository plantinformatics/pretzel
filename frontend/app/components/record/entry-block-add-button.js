import Ember from 'ember';
import EntryBase from './entry-base';


export default EntryBase.extend({
  tagName: '',


  /*--------------------------------------------------------------------------*/
  actions : {
    loadBlock(block) {
      console.log('entry-block-add-button: loadBlock', block, arguments);
      this.sendAction('loadBlock', block);
    }
  } // actions
  /*--------------------------------------------------------------------------*/


});
