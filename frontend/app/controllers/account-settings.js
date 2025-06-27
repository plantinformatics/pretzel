import Controller from '@ember/controller';
import { inject as service } from '@ember/service';


//------------------------------------------------------------------------------

const dLog = console.debug;

//------------------------------------------------------------------------------


/** Route for user account settings, e.g. personalised colour choices.
 * The plan is to move into this : change-password, maybe logout.
 */
export default class AccountSettingsController extends Controller {

  /**
   * showColourThemeModal	enables display of the Colour Theme Selector dialog in colour-theme-selector
   */
  userSettings = {showColourThemeModal : false};
  
}
