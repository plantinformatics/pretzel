import Component from '@glimmer/component';

import EmberObject, { computed, action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

//------------------------------------------------------------------------------

import vcfGenotypeBrapi from '@plantinformatics/vcf-genotype-brapi';
const /*import */{
  passportFieldNames,
} = vcfGenotypeBrapi.genolinkPassport; /*from 'vcf-genotype-brapi'; */

//------------------------------------------------------------------------------

const dLog = console.debug;

//------------------------------------------------------------------------------

/** Display in a <select> the list of Passport data field names which can be
 * requested from the Genolink API endpoint /api/genesys/accession/query,
 * enabling the user to select which fields to add to the Genotype Table sample
 * / accession column headers.
 * @param userSettings	Genotype Table userSettings
 */
export default class PanelSelectPassportFieldsComponent extends Component {

  passportFieldNames = passportFieldNames.map(name => ({id : name, name}));

  //----------------------------------------------------------------------------

  /** Called via user selection change in select-multiple
   * The parameters added and deleted indicate changes to the selection.
   * They are arrays of :
   *  { id, name, ... } Ember Object
   * See form/select-multiple.js : selectedGroupChangedId().
   *
   * @param values : current list of selected values;  === userSettings.passportFields
   * @param c : element de/selected in the current event
   * @param add : true if c was selected
   *
   * based on haplotypes-samples.js : selectedHaplotypeChanged()
   */
  @action
  selectedFieldsChanged(values, c, add) {
    const fnName = 'selectedHaplotypeChanged';
    const userSettings = this.args.userSettings;

    dLog(fnName, values, c, add, userSettings.passportFields);
    this.args.selectedFieldsChanged(values, c, add);
  }

  //----------------------------------------------------------------------------

}


