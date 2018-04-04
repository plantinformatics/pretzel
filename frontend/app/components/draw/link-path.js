import Ember from 'ember';

const { inject: { service } } = Ember;


/** Interact with the backend API Blocks/paths to request links / paths (direct and aliased) connecting blocks.
 * Driven by event / action from draw-map (or stacks) which notifies of :
 * adjacency change -> expose axis/axis -> block/block (collateStacksA) ->
 * results are delivered to pathReceiver (draw-map currently) via .trigger('paths')
 *
 * Future design is for rendering to be moved out to sub-components; this
 * component can render the paths.
*/
export default Ember.Component.extend(Ember.Evented, {

  auth: service('auth'),
  store: service(),

  willInsertElement() {
    console.log('components/draw/link-path willInsertElement');
    let stackEvents = this.get('stackEvents');
    stackEvents.on('expose', this, function (blockA, blockB) {
      console.log('path expose', blockA, blockB);
      this.request(blockA, blockB);
    } );
  },
  willDestroyElement() {
    let stackEvents = this.get('stackEvents');
    stackEvents.off('expose');
  },

  request : function (blockA, blockB) {
    console.log('path request', blockA, blockB);
    let me = this;

    this.get('auth').getPaths(blockA, blockB, /*options*/{})
      .then(
        function(res){
          console.log('path request then', res.length);
          let id = blockA + "," + blockB;
          me.push(id, res);
          console.log('link-path pathReceiver', me.get('pathReceiver'));
          me.get('pathReceiver').trigger('paths', blockA, blockB, res);
        },
        function(err, status) {
          console.log('path request', blockA, blockB, me, err.responseJSON[status] /* .error.message*/, status);
        });


  },

  push : function (id, paths) {
    console.log('path push', paths.length);
    let pushData = 
      {
        data: {
          id: id,
          type: 'link-path',
          attributes: paths
        }
      };
    // silently fails to return
    // this.get('store').push(pushData);
  },


});
