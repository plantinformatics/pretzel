/*----------------------------------------------------------------------------*/
/* Shared constants / functions to provided consistent id of tabs in data explorer. */


const tab_explorer_prefix = "tab-explorer-";

function text2EltId(name) {
  let id = name.replace(/[^-_A-Za-z0-9]+/g, '-');
  return id;
}

const trace_dataTree = 0;

    /** invoked from hbs via {{compute (action "datasetTypeTabId" datasetType ) }}
     * @return string suitable for naming a html tab, based on datasetType name.
     */
function datasetTypeTabId(datasetType) {
  let
  id = tab_explorer_prefix + text2EltId(datasetType);
  if (trace_dataTree)
    dLog('datasetTypeTabId', id, datasetType);
  return id;
}


/*----------------------------------------------------------------------------*/

export {tab_explorer_prefix, text2EltId, datasetTypeTabId };
