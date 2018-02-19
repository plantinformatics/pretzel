/*----------------------------------------------------------------------------*/

// factored out of app/components/goto-feature.js

/** For listening to Evented objects.
 * @see usage examples in createListener() in draw-map.js and goto-feature.js
*/
function EventedListener(evented, methods)
{
  this.evented = evented;
  this.methods = methods;
}
EventedListener.prototype.listen = function(listen)
{
  // based on drawActionsListen() (draw-map.js)
    console.log("EventedListener listen()", listen, this);
    {
      let onOff = listen ? this.evented.on : this.evented.off,
      me = this;
      this.methods.map(function (f) {
        onOff.apply(me.evented, [f.name, f.target, f.method]);
      });
      }
};

/*----------------------------------------------------------------------------*/

export { EventedListener };
