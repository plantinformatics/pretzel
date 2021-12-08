import { helper } from '@ember/component/helper';
import { htmlSafe } from '@ember/template';

/* global CSS */

/** Sanitize a colour value for binding to style=background-color:...
 * @params  currently just [colour], but can be [ [field-name, value], ... ]
 */
export default helper(function safeStyle(params/*, hash*/) {
  let result;
  if (params && params[0] && params[0]?.startsWith('#')) {
    /** param value e.g. "#1f77b4"
     * split off the # because CSS.escape() will map that to \#, which the browser will reject. */
    let colorHex = params[0].slice(1);
    let color = CSS.escape(colorHex);
    result = htmlSafe("background-color: #" + color);
  }
  return result;
});
