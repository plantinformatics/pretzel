import Component from '@glimmer/component';
import { computed, action } from '@ember/object';
import { alias } from '@ember/object/computed';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { later } from '@ember/runloop';

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
varAssignFunctionRe = /(?:([A-Za-z0-9_]+) = )?([A-Za-z0-9_]+)\((?:([-"A-Za-z0-9_ ]+), )*([-"A-Za-z0-9_ ]+)\)/;


export default class FormNaturalSearchComponent extends Component {
  @service() auth;
  @service() queryParams;
  @service('data/dataset') datasetService;
  @service() controls;

  @service() apiServers;

  //----------------------------------------------------------------------------

  @alias('controls.apiServerSelectedOrPrimary') apiServerSelectedOrPrimary;


  //----------------------------------------------------------------------------


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
          // split at space after "),", and keep the "),"
          this.naturalQueryResult = results
            .split(/(?<=\),) /);
          this.interpretCommands(results);
        } else {
          this.naturalQueryResult = null;
        }
      });
    }
  }

  @computed
  get functions() {
    const
    result = { 
      display : this.display.bind(this),
      dna_search : this.dna_search.bind(this),
      zoom : this.zoom.bind(this),
      gene_or_marker_search : this.gene_or_marker_search.bind(this),
    };
    return result;
  }
  vars = {};

  interpretCommands(result) {
    this.queryParams.queryParamsHost.set('naturalAuto', true);
    const
    fnName = 'interpretCommands',
    functions = this.functions;
    if (result.startsWith('Answer: ')) {
      result = result.replace(/^Answer: /, '');
    }
    if (result.endsWith('.')) {
      result = result.replace(/\.$/, '');
    }
    const
    lines = result.split(/[\n;]/);
    lines.forEach(line => {
      let match, whole, varName, functionName, params;
      // position_interval = gene_or_marker_search(gene_or_marker_names)
      // var line = 'position_interval = gene_or_marker_search(BobWhite_c10090_559, BobWhite_c1002_263)';
      if (! line) {
      } else if ((match = line.match(varAssignFunctionRe))) {
        [whole, varName, functionName, ...params] = match;
        if (Array.isArray(params) && params.length) {
          params = params
            .filter(param => param)
            .map(p => {const m = p.match(/^"([^"]+)"$/); return m ? m[1] : p; });
        }
        let result, fn;
        if (functionName && (fn = functions[functionName])) {
          result = fn.apply(this, params);
          if (varName) {
            this.vars[varName] = result;
          }
        } else {
          dLog(fnName, varName, functionName, params);
        }
      } else {
        dLog(fnName, line);
      }
    });
    this.queryParams.queryParamsHost.set('naturalAuto', false);
  }

  //----------------------------------------------------------------------------

  display(datasetText, chromosome) {
    const fnName = 'display';

    // based on manage-explorer.js : naturalQueryChanged()
    const value = datasetText;
    if (value?.length) {
      const options = {server : this.apiServerSelectedOrPrimary};
      this.auth.naturalSearch(value, options).then(results => {
      if (results?.length) {
        const ids = results.mapBy('item.id');
        const datasets = ids.map(datasetId =>
          this.nameChr2Dataset(datasetId, chromosome));
        dLog(fnName, datasets);
        // loadBlock
      } else {
        this.set('naturalQueryResult', null);
        dLog(fnName, datasetText);
      }
    });
    } else {
      dLog(fnName, datasetText, chromosome);
    }
  }
  nameChr2Dataset(datasetName, chromosome) {
    /// uses .primaryServer
    const
    fnName = 'nameChr2Dataset',
    datasets = this.datasetService.datasetsForName(datasetName);
    if (chromosome) {
      const
      blocks = datasets.map(dataset =>
        dataset?.dataset.blocks.findBy('name', chromosome))
        .filter(block => block);
      later(() => blocks.forEach(block => this.args.loadBlock(block, true)));
    }
    /* or nameChr2Block() or this.datasetService.datasetsByName,
    dataset = datasets[datasetName]; */

    dLog(fnName, datasetName, chromosome, datasets.length);
    return datasets;
  }
  nameChr2Block(datasetName, chromosome) {
    if (! datasetName || ! chromosome) {
      return undefined;
    }
    const
    fnName = 'nameChr2Block',
    store = this.apiServerSelectedOrPrimary.store,
    allBlocks = store.peekAll('block'),
    block = allBlocks.find(
      b => b.datasetId.content.id === datasetName &&
        b.name === chromosome);
    return block;
  }

  dna_search(dnaSequenceText, referenceAssemblyName) {
    const fnName = 'dna_search';
    dLog(fnName, dnaSequenceText, referenceAssemblyName);
  }

  zoom(start_position, end_position) {
    const fnName = 'zoom';
    dLog(fnName, start_position, end_position);
  }
  
  /** Search for the given Feature (gene or marker) names.
   * @return a promise yielding the extent of the matching positions, per reference Block.
   */
  gene_or_marker_search(featureNames) {
    this.queryParams.queryParamsHost.set('searchFeatureNames', featureNames);
  }

  //----------------------------------------------------------------------------

}
