import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { alias } from '@ember/object/computed';

import { action, set as Ember_set } from '@ember/object';

//------------------------------------------------------------------------------

const dLog = console.debug;

//------------------------------------------------------------------------------

const
/** agreements contains key : agreementText description pairs; the key is
 * displayed as the checkbox label and agreementText defines the agreement and
 * is displayed beside the checkbox.  key is also used as the key of the
 * checkbox value in localStorage.
 */
agreements =
  {
    Genolink : "Passport data is sourced by Genolink from Genesys-PGR. Use of this service means you agree to the Genesys-PGR Terms and Conditions and acknowledge Genesys-PGR as the source when using Genolink data.  Refn : https://www.genesys-pgr.org/",
  };

/**   form/data-licence-agreements
 * For each data-licence-agreements, display checkbox and text.
 */
export default class ColourThemeSelectorComponent extends Component {
  @service() controls;

  @alias('controls.userSettings.localStorage') localStorage;
  @alias('localStorage.dataLicenceAgreements') userSettings;

  // this.agreements is used in .hbs
  agreements = agreements;

  /** Called from <input checkbox > via set this.userSettings name
   */
  @action
  userSettingsChange(name, value) {
    const fnName = 'userSettingsChange';
    dLog(fnName, name, value);
    const localStorage = this.localStorage;
    Ember_set(this.userSettings, name, value);
    /** This is required to write the changed value to browser localStorage. */
    localStorage.set('dataLicenceAgreements', localStorage.get('dataLicenceAgreements'));
  }

}
