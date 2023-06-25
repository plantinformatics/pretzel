import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';

//------------------------------------------------------------------------------

const dLog = console.debug;

//------------------------------------------------------------------------------

/** Show a message to the user, using alert().
 */
function userMessage(text) {
  alert(text);
}

//------------------------------------------------------------------------------



export default class FormNaturalSearchComponent extends Component {
  @service() auth;

  userMessage = userMessage;

  searchText = '';
  @tracked
  naturalQueryResult = '';
  @action
  searchTextInput(value) {
    const fnName = 'searchTextInput';
    const commands_text = value.replaceAll(/\n+$/g, '');
    if (commands_text.length && (commands_text !== this.previousCommandText)) {
      this.previousCommandText = commands_text;
      const options = {server : this.apiServerSelectedOrPrimary};
      this.auth.text2Commands(commands_text, options).then(results => {
        dLog(fnName, results);
        if (results?.length) {
          this.naturalQueryResult = results;
          // ...
        } else {
          this.naturalQueryResult = null;
        }
      });
    }
  }

}
