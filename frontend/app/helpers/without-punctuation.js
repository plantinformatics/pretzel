import { helper } from '@ember/component/helper';

export default helper(function withoutPunctuation(params/*, hash*/) {
  /** alternatives which handle unicode : https://stackoverflow.com/questions/4328500/how-can-i-strip-all-punctuation-from-a-string-in-javascript-using-regex  */
  let result = params.map((text) => text.replace(/[^\w]/g, '_'));
  return result;
});
