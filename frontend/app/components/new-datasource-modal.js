import { on } from '@ember/object/evented';
import { inject as service } from '@ember/service';
import Component from '@ember/component';
import EmberObject, { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import { bind, later, throttle } from '@ember/runloop';

import $ from 'jquery';

import { nameSort } from '../utils/common/arrays';
import { serverTypeIsGerminateAPI } from './service/api-server';

//------------------------------------------------------------------------------

const dLog = console.debug;

//------------------------------------------------------------------------------

/** select-type.hbs uses .id and .name.
 * As commented in selectedTypeChanged(), this will probably not be required and
 * can be dropped, and remove commented-out code in typesForSelect() also.
 * Based on utils/data/groups.js : noGroup.
 */
const noType = EmberObject.create({id : 'noType', name : ''});

function chrMappingDefault() {
  const
  array =
    [1, 2, 3, 4, 5, 6, 7].map((chrNum, ci) =>
      ['A', 'B', 'D'].map((subGenome, sgi) =>
        ([ci * 3 + sgi + 1, '' + chrNum + subGenome]))),
  text = array.map(row => row.map(c => c.join(' ')).join('\n')).join('\n');
  return text;
}

let optionWidth = 47;
console.log('optionWidth', optionWidth);
/** <select> <option> is provided by the operating system and so its width
 * cannot be constrained using CSS.
 * As a fall-back, the text to be displayed is truncated as necessary and
 * ellipsis is appended.
 */
function truncateOptionText(text) {
  const
  truncated = (text.length <= optionWidth) ? text :
    text.substring(0, optionWidth - 3) + '...';
  return truncated;
}

//------------------------------------------------------------------------------


export default Component.extend({
  apiServers: service(),
  dataset : service('data/dataset'),
  dataView : service('data/view'),
  queryParams: service('query-params'),

  urlOptions : alias('queryParams.urlOptions'),

  didInsertElement: on('didInsertElement', function() {
    let confirmButton = $('button[name=confirm]', this.element);
    $('input[name=password]', this.element).keyup(function(event) {
        if (event.keyCode == 13) {
            confirmButton.click();
        }
    });

    dLog('new-datasource-modal', 'didInsertElement', this);
    // used in development only, in Web Inspector console.
    if (window.PretzelFrontend) {
      window.PretzelFrontend.newDatasourceModal = this;
    }
  }),

  actions: {
    onConfirm() {
      const fnName = 'onConfirm';
      console.log(fnName);
      let host = $('input[name=host]', this.element).val();
      let user = $('input[name=user]', this.element).val();
      let password = $('input[name=password]', this.element).val();
      const serverType = this.typeSelected.id;
      if (host == "" || user == "" || password == "") {
        /* host, user, password are required inputs.
         * Can make 'confirm' button sensitive when they are non-empty.
         *
         * onConfirm() is called when these values are "", immediately after it
         * is called with the correct values.
         * This can be changed to use ember input binding value= instead of
         * jQuery $('input[name=...]', this.element).val() (or .value ?).
         */
        dLog(fnName, 'empty input', host, user, password.length);
      }
      else {
        if (host.match(/\/mapview\/.*/)) {
          host = host.replace(/\/mapview\/.*/, '');
          $('input[name=host]', this.element).val(host);
        }
        if (! host.match(/^https?:\/\//)) {
          host = "https://" + host;
          $('input[name=host]', this.element).val(host);
        }

        this.set('errorText', null);
        let promise = this.get('apiServers').ServerLogin(serverType, host, user, password);
        promise
          .then((server) => {
            server.serverType = serverType;
            if (this.typeRequiresParent) {
              server.parentName = this.datasetSelected.id;
              server.chrMapping = this.chrMappingArray;
              this.dataView.axesForViewedBlocks();
              dLog(fnName, server);
            }
            this.close();
          })
          .catch((error) => {
            let
            errorText = ! error ? ' ' :
              (typeof error === "object") && 
              (Object.entries(error).map((kv) => kv.join(' : ')).join(', '))
              || '' + error;
            this.set('errorText', '' + errorText); });
      }
    }
  },

  close : function() {
    dLog('close');
    this.closeNewDatasourceModal();
  },

  //----------------------------------------------------------------------------
  // textarea is based on similar in sequence-search and feature-list.

  chrMapping : '',  // chrMappingDefault(),
  get chrMappingArray() {
    const
    array = (this.chrMapping || '')
      .split('\n')
      .map(line => line.split(' '))
    return array;
  },

  chrMappingInput(event) {
    dLog('chrMappingInput', event?.target);
    let text = event?.target?.value;
    if (text) {
      this.chrMapping = text;
    }
  },
  paste: function(event) {
    /** text is "" at this time. */
    /** this action function is called before jQuery val() is updated. */
    later(() => {
      const text = event && (event.target.value || event.originalEvent.target.value);
      dLog('paste', event, text.length, text);
      // maybe re-format the pasted text
    }, 500);
  },

  chrMappingInputAction(text, event) {
    dLog("chrMappingInput", text.length, event.keyCode, text);
    this.chrMapping = text;
    // throttle(this.get('chrMappingInputBound'), 2000);
  },

  /** throttle depends on constant function  */
  chrMappingInputBound : computed(function() {
    return bind(this, this.chrMappingInput);
  }),


  /** Clear chrMapping and copie it to the textarea.
   * Not used.
   */
  clear() {
    this.chrMapping = '';
    this.text2Area();
  },

  text$ : computed(function () {
    const selection = $('textarea#ndm_chrMapping', this.element);
    dLog('text$', selection);
    return selection;
  }),

  /** Copy .text to the textarea. */
  text2Area() {
    this.get('text$').val(this.chrMapping);
  },


  //----------------------------------------------------------------------------

  typeSelected : undefined,
  typeIsGerminate : computed('typeSelected', function () {
    return this.typeSelected.id === 'Germinate';
  }),
  typeRequiresParent : computed('typeSelected', function () {
    return serverTypeIsGerminateAPI(this.typeSelected.id);
  }),

  typesForSelect : computed(function () {
    const
    fnName = 'typesForSelect',
    typeNames = ['Pretzel' /*, 'noType'*/];
    if (this.urlOptions.Germinate) {
      typeNames.push('Germinate');
    }
    if (this.urlOptions.SparkServer) {
      typeNames.push('Spark');
    }
    const
    types = typeNames
      .map(name => ({id : name, name}))
    
    // types[2].name = '';
    // types.findBy('id', 'noType').name = '';
    this.set('typeSelected', types.findBy('id', 'Pretzel'));
    return types;
  }),

  /**
   * @param selectedType  { id, name }, e.g. { id : 'Germinate', name: 'Germinate' }
   */
  selectedTypeChanged(selectedType) {
    /* selectedType is required to have a defined value, so this won't be needed.
    if (selectedType === noType) {
      selectedType = null;
    }
    */
    this.set('typeSelected', selectedType);
    if ((selectedType.id === 'Germinate') /*&& $('input[name=host]', this.element).val() === ''*/) {
      $('input[name=host]', this.element).val('https://germinate.plantinformatics.io');
    }
  },

  //----------------------------------------------------------------------------

  /** @return the list of datasets which are of type Genome,
   * i.e. are parents / references.
   * @desc
   * This is calculated once.
   */
  genomeDatasets : computed(function () {
    const datasets = this.get('dataset').datasetsForType('Genome', false);
    return datasets;
  }),

  /** Calculate chrMapping from chromosomes (blocks scopes) of selectedDataset.
   * @param selectedDataset {id, name}
   */
  chrMappingFor(selectedDataset) {
    const 
    selected = this.genomeDatasets.findBy('dataset.id', selectedDataset.id),
    dataset = selected.dataset,
    /** linkagegroup id starts at 1 for each dataset */
    blockScopes = dataset.blocks
      .mapBy('scope'),
    /* this sort handles <number><text>; instead use nameSort which handles
     * <text><number><text>
     * .sort((a, b) => (+a === +b) ? (+a - b) : a > b)
     */
    chrMapping = nameSort(blockScopes)
      .map((scope, i) => (i+1).toString() + ' ' + scope).join('\n');
    return chrMapping;
  },
  /** Set this.chrMapping, and also display it in the <textarea>, because
   * {{textarea value=this.chrMapping }} only reads .chrMapping when it is
   * created.
   */
  setChrMapping(chrMapping) {
    /** This could be "set chrMapping() {", although it is not needed if chrMapping
     * is defined before the {{textarea}} is created.
     */
    const
    textarea = $('textarea#ndm_chrMapping')?.[0];
    if (textarea) {
      textarea.value = chrMapping;
    }
    this.chrMapping = chrMapping;
  },

  //----------------------------------------------------------------------------

  /** parentDataset */
  datasetSelected : undefined,
  datasetsForSelect : computed('dataset.datasetsForType', function () {
    const
    datasets = this.genomeDatasets
      /** @param dsn  { dataset, serverName } */
      .map(dsn => { const name = dsn.dataset.name; return {id : name, name : truncateOptionText(name)}; });

    /** .datasetsForSelect is displayed in {{select-group / datasetSelected /
     * datasetsForSelect}}, and when it updates .datasetsForSelect will be
     * selected if it is defined and in the list (it is initially undefined).
     * So if .datasetsForSelect is not defined, set it to the first value.
     * This could be split out as an Effect. */
    if (datasets.length && ! this.selectedDataset) {
      const selectedDataset = datasets[0];
      this.setSelectedDataset(selectedDataset);
    }

    return datasets;
  }),
  setSelectedDataset(selectedDataset) {
    this.set('datasetSelected', selectedDataset);
    this.setChrMapping(this.chrMappingFor(selectedDataset));
  },
  selectedDatasetChanged(selectedDataset) {
    /* selectedDataset (parent) is required to have a defined value,
     * so this won't be needed.
    if (selectedDataset === noDataset) {
      selectedDataset = null;
    }
    */
    this.setSelectedDataset(selectedDataset);
  },


  //----------------------------------------------------------------------------

});
