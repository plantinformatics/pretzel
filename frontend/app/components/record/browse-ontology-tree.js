import { computed } from '@ember/object';

import ObjectProxy from '@ember/object/proxy';
import PromiseProxyMixin from '@ember/object/promise-proxy-mixin';
import { resolve, all } from 'rsvp';

import EntryBase from './entry-base';

import { thenOrNow } from '../../utils/common/promises';

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

  /*--------------------------------------------------------------------------*/

  /**
   * @param value .type === "term", value is a root of an Ontology tree.
   */
  rootOntologyNameId : computed('values', function () {
    let
    valuesP = this.values,
    text = thenOrNow(valuesP, (values) => ('[' + values.id + ']  ' + values.text));

    let ObjectPromiseProxy = ObjectProxy.extend(PromiseProxyMixin);
    let proxy = ObjectPromiseProxy.create({ promise: resolve(text) });

    return proxy;
  }),

  /*--------------------------------------------------------------------------*/

});



