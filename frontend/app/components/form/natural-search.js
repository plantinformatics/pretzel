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

const
nameSearchRe = /([A-Za-z0-9_]+) = ([A-Za-z0-9_]+)\((?:([A-Za-z0-9_]+), )+([A-Za-z0-9_]+)\)/;


export default class FormNaturalSearchComponent extends Component {
  @service() auth;
  @service() queryParams;

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
          this.interpretCommands(results);
        } else {
          this.naturalQueryResult = null;
        }
      });
    }
  }

  vars = {};

  interpretCommands(result) {
    const
    lines = result.split('\n');
    lines.forEach(line => {
      let match, whole, varName, functionName, params;
      // position_interval = gene_or_marker_search(gene_or_marker_names)
      // var line = 'position_interval = gene_or_marker_search(BobWhite_c10090_559, BobWhite_c1002_263)';
      if ((match = line.match(nameSearchRe))) {
        [whole, varName, functionName, ...params] = match;
        this.vars[varName] = this.gene_or_marker_search(params);
      }
    });
  }

  /** Search for the given Feature (gene or marker) names.
   * @return a promise yielding the extent of the matching positions, per reference Block.
   */
  gene_or_marker_search(featureNames) {
    this.queryParams.queryParamsHost.set('searchFeatureNames', featureNames);
  }

}
