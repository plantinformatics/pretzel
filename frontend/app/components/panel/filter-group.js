import Component from '@ember/component';
import { inject as service } from '@ember/service';

export default Component.extend({
  blockService: service('data/block'),

  tagName : 'li',
  classNames : ['filter-group'],



  actions : {

    /** no function yet, may not be needed */
    applyTabActive : function(tabName) {
      console.log('applyTabActive', tabName);
    },


    deleteFilterOrGroup : function () {
      console.log('deleteFilterOrGroup', this);
      this.sendAction('deleteFilterOrGroup', this);
    },
    filterByCurrentScopes : function () {
      console.log('filterByCurrentScopes', this);
      this.filterByCurrentScopes();
    }
  },


  filterByCurrentScopes() {
    let block_viewedScopes = this.get('blockService.viewedScopes'),
    pattern = block_viewedScopes.join(' ');
    console.log('filterByCurrentScopes', block_viewedScopes, pattern);
    // possibly only set pattern when block_viewedScopes.length > 0
    this.set('data.pattern', pattern);
    this.sendAction('changed', this);
  }

});

