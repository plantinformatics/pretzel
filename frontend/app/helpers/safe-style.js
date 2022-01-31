import { helper } from '@ember/component/helper';
import { htmlSafe } from '@ember/template';

/* global CSS */

/** Sanitize a colour value for binding to style=background-color:...
 * @param positionalParams  not used (positionalParams[0] was background-color until f49adc5a)
 * @param namedParams e.g. {background-color : "#1f77b4", ... }
 */
export default helper(function safeStyle(positionalParams, namedParams) {
  let
  texts = Object.entries(namedParams).map(([name, value]) => {
    let paramText;
    if (value === undefined) {
    } else if (false && name.endsWith('-color') && value.startsWith('#')) {
      /** param value e.g. "#1f77b4"
       * split off the # because CSS.escape() will map that to \#, which the browser will reject. */
      let colorHex = value.slice(1);
      let color = CSS.escape(colorHex);
      paramText = htmlSafe(name + ": #" + color);
    } else {
      paramText = htmlSafe(name + ":" + value);
    }
    return paramText;
  }),
  result = texts.join('; ');
  return result;
});
