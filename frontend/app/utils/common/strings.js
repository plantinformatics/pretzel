/*----------------------------------------------------------------------------*/

/** Parse an optional url query param of this form :
 * alpha=a,split:11,dot=01,devel
 */
function parseOptions(options_param)
{
  let options = {};
  if (options_param)
  {
    options_param.split(',').reduce(function(result, opt) {
      /** Want to split(/[:=]/), but also sanitise the name and value, so just
       * split on any non-alphanumeric, so all punctuation is discarded. (allow '_')
       */
      let [name, val] = opt.split(/[^A-Za-z0-9_]/);
      result[name] = val || true;
      return result;
    }, options);
  }
  return options;
}

/*----------------------------------------------------------------------------*/

export {
  parseOptions
};
