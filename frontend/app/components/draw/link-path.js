import { computed } from '@ember/object';
import Evented from '@ember/object/evented';
import Component from '@ember/component';
import { inject as service } from '@ember/service';

import { parseOptions } from '../../utils/common/strings';

let trace_links = 1;

/** Interact with the backend API Blocks/paths to request links / paths (direct and aliased) connecting blocks.
 * Driven by event / action from draw-map (or stacks) which notifies of :
 * adjacency change -> expose axis/axis -> block/block (collateStacksA) ->
 * results are delivered to pathReceiver (draw-map currently) via .trigger('paths')
 *
 * Future design is for rendering to be moved out to sub-components; this
 * component can render the paths.
*/
export default Component.extend(Evented, {

  auth: service('auth'),
  store: service(), // not used - can remove
  blockService: service('data/block'),

  /** based on similar in flow-controls.js */
  parsedOptions : computed('modelParamOptions', function () {
    let options,
    options_param;
    if ((options_param = this.get('modelParamOptions'))
        && (options = parseOptions(options_param)))
    {
      console.log('parsedOptions', options);
    }
    return options;
  }),


  didInsertElement() {
    this._super.apply(this, arguments);

    const fnName = 'didInsertElement';
    if (trace_links)
      console.log('components/draw/link-path', fnName);

    let options = this.get('parsedOptions'),
    byReference = options && options.byReference;
    console.log(fnName, options, byReference);

    let stackEvents = this.get('stackEvents');
    if (options && options.allInitially)
    stackEvents.on('expose', this, this.exposeHandler);
  },
  exposeHandler (blockA, blockB) {
    let options = this.get('parsedOptions'),
    byReference = options && options.byReference;
    let blockService = this.get('blockService'),
    blocksSameServer = blockService.get('blocksSameServer');
      if (! blocksSameServer.apply(blockService, [blockA, blockB]))
      {
        console.log('blocksSameServer', blockA, blockB);
        return;
      }
      if (trace_links > 1)
        console.log('path expose', blockA, blockB);
      this.request(blockA, blockB);
      if (byReference)
        this.requestByReference(blockA, blockB);
  },
  willDestroyElement() {
    let options = this.get('parsedOptions');
    if (options && options.allInitially) {
      let stackEvents = this.get('stackEvents');
      stackEvents.off('expose', this, this.exposeHandler);
    }

    this._super.apply(this, arguments);
  },

  request : function (blockA, blockB) {
    if (trace_links > 2)
      console.log('path request', blockA, blockB);
    let me = this;

    this.get('auth').getPaths(blockA, blockB, true, /*options*/{})
      .then(
        function(res){
          if (trace_links > 1)
            console.log('path request then', res.length);

          if (trace_links > 1)
            console.log('link-path pathReceiver', me.get('pathReceiver'));
          me.get('pathReceiver').trigger('paths', blockA, blockB, res);
        },
        function(err, status) {
          console.log('path request', blockA, blockB, me, err.responseJSON[status] /* .error.message*/, status);
        });


  },


  /** If the block's dataset's parent is the reference, then pathsByReference()
   * would return a result like the direct links, so don't use it in this
   * case. */
  datasetParentIsReference : function(blockId, referenceName)
  {
    let block = this.get('blockService').peekBlock(blockId),
    referenceDatasetName = block && block.get('referenceDatasetName'),
    match = referenceName == referenceDatasetName;
    if (trace_links /*> 1*/)
      console.log('datasetParentIsReference', match, blockId, block, referenceDatasetName, 'for pathsByReference');
    return match;
  },

  /** Request pathsByReference between the 2 blocks for a reference
   * in which there are marker sets with the blocks' namespaces and scopes.
   */
  requestByReference : function (blockA, blockB) {
    /** Will search for the reference to use.
     * With test dataset : "myGenome"
     */
    let referenceGenome = "Triticum_aestivum_IWGSC_RefSeq_v1.0",
    /** e.g. 1% of the chromosome length */
    maxDistance = 500000000 / 100;

    if ( this.datasetParentIsReference(blockA, referenceGenome)
         || this.datasetParentIsReference(blockB, referenceGenome)
       )
    {
      return ;
    }


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



});
