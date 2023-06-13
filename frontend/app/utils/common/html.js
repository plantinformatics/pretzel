//------------------------------------------------------------------------------

/** Parse a specific error page which is received in response to
 * authentication failure in login.
 * @see components/form/user-login.js : sendRequest()
 */
function htmlErrorParse(htmlText) {
  const
  parser = new DOMParser(),
  htmlDoc = parser.parseFromString(htmlText, 'text/html'),
  /// "Error"
  title = htmlDoc?.title,
  body = htmlDoc?.body,
  pre_ = body?.getElementsByTagName('pre'),
  pre = pre?.[0],
  /** Array [ "Error: login failed    at ", "Error: login failed" ] */
  match = pre?.textContent.match(/(.+?)....at /);
  let result;
  if (match) {
    const prefix = match[2].startsWith(match[1]) ? '' : match[1] + ' ';
    result = prefix + match[1];
  }
  
  /** Chrome requires TrustedHTMLfor parseFromString :
   * Failed to execute 'parseFromString' on 'DOMParser': This document requires 'TrustedHTML' assignment.
   */

  return result;
}

//------------------------------------------------------------------------------

export {
  htmlErrorParse,
}
