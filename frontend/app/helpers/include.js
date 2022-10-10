import { helper } from '@ember/component/helper';

/** @return true if items includes value
 * @param  params positional (array) parameters : [items, value]
 * items : <T>[]  or undefined
 * value : <T>
 */
export default helper(function include(params/*, hash*/) {
  const [items, value] = params;
  return items?.indexOf(value) > -1;
});
