import Component from '@glimmer/component';

import EmberObject, { computed, action, set as Ember_set } from '@ember/object';
import { tracked } from '@glimmer/tracking';

//------------------------------------------------------------------------------

import vcfGenotypeBrapi from '@plantinformatics/vcf-genotype-brapi';
const /*import */{
  passportFieldNames,
} = vcfGenotypeBrapi.genolinkPassport; /*from 'vcf-genotype-brapi'; */

//------------------------------------------------------------------------------

const dLog = console.debug;

const useSelectMultiple = false;
/** form/select-multiple requires the list of available and selected items to be
 *     arrays of : { id, name, ... } Ember Object
 * Whereas panel/dual-list requires them to be simply arrays of names.
 */
function itemsToNames(list) {
  return useSelectMultiple ? list.mapBy('id') : list;
}


//------------------------------------------------------------------------------

/** Display in a <select> the list of Passport data field names which can be
 * requested from the Genolink API endpoint /api/genesys/accession/query,
 * enabling the user to select which fields to add to the Genotype Table sample
 * / accession column headers.
 * @param userSettings	Genotype Table userSettings
 */
export default class PanelSelectPassportFieldsComponent extends Component {

  passportFieldNames = passportFieldNames;
  passportFieldNamesObj = passportFieldNames.map(name => ({id : name, name}));

  @tracked
  genolinkErrorMessage = null;

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
    const fnName = 'selectedFieldsChanged';
    const userSettings = this.args.userSettings;
    // Notify of change - trigger reactivity
    Ember_set(userSettings, 'passportFields', values);

    dLog(fnName, itemsToNames(values), c, add, itemsToNames(userSettings.passportFields));
    this.genolinkErrorMessage = null;
    const getPassportDataP = this.args.selectedFieldsChanged(values, c, add);
    getPassportDataP?.catch(error => {
      this.genolinkErrorMessage = error.message;
    });
  }

  @action
  updateAndClose() {
    this.args.genotypeTable.showSamplesWithinBrush();
    const userSettings = this.args.userSettings;
    Ember_set(userSettings, 'showSelectPassportFields', false);
  }

  //----------------------------------------------------------------------------

}

