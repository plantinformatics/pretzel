/*global d3 */

/*----------------------------------------------------------------------------*/

/** Make the given DOM element width resizable;  it is expected to contain an element
 * .resizer, which is what the user drags.
 * The .resizer is styled to position to the right or left edge :
 * e.g. <div class="resizer" style="float:right; width:10px; height:10px">X</div>
 * or instead of float:right could use position: absolute; right: -5px;
 * and with a suitable horizontal resize icon e.g. glyphicon-resize-horizontal 
 * or http://fontawesome.io/3.2.1/icon/resize-horizontal/
 *
 * This is equivalent to jquery-ui .resizable(), which is not working with the
 * current set of framework and tools versions
 *  ("TypeError: this._handles.disableSelection is not a function").
 *
 * Usage eg.     eltWidthResizable('#holder');
 *
 * @param eltSelector DOM element to make resizable
 */
function eltWidthResizable(eltSelector)
{
  /** refn : meetamit https://stackoverflow.com/a/25792309  */
  let resizable = d3.select(eltSelector);
  let resizer = resizable.select('.resizer');

  let dragResize = d3.drag()  // d3 v3: was .behavior
    .on('drag', function() {
      // Determine resizer position relative to resizable (parent)
      let x = d3.mouse(this.parentNode)[0];
      console.log("eltWidthResizable drag x=", x);
      // Avoid negative or really small widths
      x = Math.max(50, x);

      resizable.style('width', x + 'px');
    });
  if (resizer)
    resizer.call(dragResize);
  else
    console.log("eltWidthResizable() resizer=", resizer, eltSelector, dragResize);
}

/*----------------------------------------------------------------------------*/

export { eltWidthResizable };
