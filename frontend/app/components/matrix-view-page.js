import Component from '@ember/component';

export default Component.extend({
  /** split out of matrix-view.js after 4ebd8b2e.
   * Possibly move these attributes from there also : style, attributeBindings.
   */
  style: 'height:100%; width:100%',
  attributeBindings: ['style:style'],

  
  didInsertElement() {
    this._super.apply(this, arguments);

    // this could be done in init()
    this.set('displayData', []);
  },

  /** initialised in didInsertElement().
   * value here was [], which would be a singleton; OK because only expect to
   * use 1 matrix-view concurrently.
   */
  displayData: null,

  actions: {
    loadBlock(block) {
      let data = this.get('displayData');
      let store = block.store;
      store.findRecord('block', block.id, {
          reload: true,
          adapterOptions: {filter: {'include': 'features'}}
      }).then(function(b)  {
        if (!data?.includes(b)) {
          data?.pushObject(b);
        }
      });
    },
    removeBlock(block) {
      let data = this.get('displayData');
      if (data?.includes(block)) {
        data.removeObject(block);
      }
    },
    selectBlock(block) {
      let selectedBlock = this.get('selectedBlock');
      if (block == selectedBlock) {
        selectedBlock = null;
      } else {
        selectedBlock = block;
      }
      this.set('selectedBlock', selectedBlock);
      // matrix-view : showSelectedBlockObserver() will call this.showSelectedBlock(this.selectedBlock);
    },

  }
});
