import Ember from 'ember';


/*--------------------------------------------------------------------------*/
const { Mixin } = Ember;

/** Listen for axisStackChanged and zoomedAxis on drawMap and call the
 * corresponding functions.
 * Used by axes-1d.js and axis-2d.js
 */
export default Mixin.create({


  listen: function() {

    /** handle of the draw-map */
    let drawMap = this.get('drawMap'); 
    console.log("listen", drawMap);
    if (drawMap === undefined)
      console.log('parent component drawMap not passed');
    else {
      drawMap.on('axisStackChanged', this, 'axisStackChanged');
      drawMap.on('resized', this, 'resized');
      drawMap.on('zoomedAxis', this, 'zoomedAxis');
    }
  }.on('init'),

    // remove the binding created in listen() above, upon component destruction
  cleanup: function() {

    let drawMap = this.get('drawMap');
    if (drawMap)
    drawMap.off('axisStackChanged', this, 'axisStackChanged');
    drawMap.off('resized', this, 'resized');
    drawMap.off('zoomedAxis', this, 'zoomedAxis');
      }.on('willDestroyElement')

});
