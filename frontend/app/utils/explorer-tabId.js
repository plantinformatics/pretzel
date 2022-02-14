/*----------------------------------------------------------------------------*/
/* Shared constants / functions to provided consistent id of tabs in data explorer
 * manage-explorer,  and manage-view
 */


const tab_explorer_prefix = "tab-explorer-";

function text2EltId(name) {
  let id = name.replace(/[^-_A-Za-z0-9]+/g, '-');
  return id;
}

function keysLength(object) {
  return Object.keys(object).length;
}

/*----------------------------------------------------------------------------*/

export {tab_explorer_prefix, text2EltId, keysLength };
