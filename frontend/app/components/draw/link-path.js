import Ember from 'ember';

const { inject: { service } } = Ember;

let trace_links = 1;

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
    if (trace_links)
      console.log('components/draw/link-path willInsertElement');
    let stackEvents = this.get('stackEvents');
    stackEvents.on('expose', this, function (blockA, blockB) {
      if (trace_links > 1)
        console.log('path expose', blockA, blockB);
      this.request(blockA, blockB);
      this.requestByReference(blockA, blockB);
    } );
  },
  willDestroyElement() {
    let stackEvents = this.get('stackEvents');
    stackEvents.off('expose');
  },

  request : function (blockA, blockB) {
    if (trace_links > 2)
      console.log('path request', blockA, blockB);
    let me = this;

    this.get('auth').getPaths(blockA, blockB, /*options*/{})
      .then(
        function(res){
          if (trace_links > 1)
            console.log('path request then', res.length);
          let id = blockA + "," + blockB;
          me.push(id, res);
          if (trace_links > 1)
            console.log('link-path pathReceiver', me.get('pathReceiver'));
          me.get('pathReceiver').trigger('paths', blockA, blockB, res);
        },
        function(err, status) {
          console.log('path request', blockA, blockB, me, err.responseJSON[status] /* .error.message*/, status);
        });


  },
  /** Request pathsByReference between the 2 blocks for a reference
   * in which there are marker sets with the blocks' namespaces and scopes.
   */
  requestByReference : function (blockA, blockB) {
    /** Will search for the reference to use.  */
    let referenceGenome = "IWGSC_RefSeq_v1.0", // "myGenome",
    /** e.g. 1% of the chromosome length */
    maxDistance = 500000000 / 100;
    if (trace_links > 2)
      console.log('pathsByReference request', blockA, blockB);
    let me = this;

    this.get('auth').getPathsByReference(blockA, blockB, referenceGenome, maxDistance, /*options*/{})
      .then(
        function(res){
          if (trace_links > 1)
            console.log('pathsByReference request then', res.length);
          if (trace_links > 2)
            console.log('link-path pathReceiver', me.get('pathReceiver'));
          me.get('pathReceiver').trigger('pathsByReference', blockA, blockB, referenceGenome, maxDistance, res);
        },
        function(err, status) {
          console.log('path request', blockA, blockB, referenceGenome, maxDistance, me, err.responseJSON[status] /* .error.message*/, status);
        });


  },

  push : function (id, paths) {
    if (trace_links > 2)
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
