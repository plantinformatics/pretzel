import Component from '@ember/component';
import { inject as service } from '@ember/service';
import { observer, computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import { later } from '@ember/runloop';
// import { action } from '@ember/object';

import { A as array_A } from '@ember/array';

/*----------------------------------------------------------------------------*/

const dLog = console.debug;

/*----------------------------------------------------------------------------*/

/**
 * @param data  is trait.traits
 */
export default Component.extend({
  // trait : service('data/trait'),

  /*--------------------------------------------------------------------------*/

  displayData : alias('data'),

  /*--------------------------------------------------------------------------*/

  viewAllFlag : false,

  viewAll(checked) {
    /** at this point, .viewAllFlag has not been updated from the current click;
     * the passed in value is target.checked, which has been updated.
     */
    dLog('viewAll', checked, this, this.viewAllFlag);
    this.get('data').forEach((d) => d.set('visible', checked));
  },

  /*--------------------------------------------------------------------------*/
  /** modal dialog displaying QTLs of a clicked trait */

  showModal : false,
  /** enables dialog, and targets it at the clicked trait */
  traitQtlsTargetId : null,
  traitSelected : null,

  /** Set or toggle .traitQtlsTargetId. */
  // @action
  traitQtlsClick(trait, click) {
    let
    target = click.target,
    id = target?.parentElement?.id || target?.id;
    this.traitSelected = trait;
    dLog('traitQtlsClick', trait.name, id, this.traitQtlsTargetId, this.showModal, this);
    if (id) {
      id = '#' + id;
      this.set('traitQtlsTargetId', id);
      this.toggleProperty('showModal');
    }
  },
  // @action
  closeTraitQtlsDialog() {
    dLog('closeTraitQtlsDialog', this.traitQtlsTargetId, this.showModal, this);
    this.set('showModal', false);
  },


});
