
import EntryBase from './entry-base';

/*----------------------------------------------------------------------------*/

const dLog = console.debug;

/*----------------------------------------------------------------------------*/

/**
 * @params selectExpander
 */
export default EntryBase.extend({

  tagName: '',

  /*--------------------------------------------------------------------------*/

  /** noAction is used for these parameters of entry-values, which are used in
   * manage-explorer, but not here - this is just for selecting the Ontology ID:
   *  loadBlock, selectBlock, selectedBlock, selectDataset, selectDataset.
   */
  noAction() {
    dLog('noAction');
  },


});



