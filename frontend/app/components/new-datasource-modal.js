import { on } from '@ember/object/evented';
import { inject as service } from '@ember/service';
import Component from '@ember/component';
import EmberObject, { computed } from '@ember/object';
import { alias } from '@ember/object/computed';


import $ from 'jquery';

//------------------------------------------------------------------------------

const dLog = console.debug;

//------------------------------------------------------------------------------

/** select-type.hbs uses .id and .name.
 * As commented in selectedTypeChanged(), this will probably not be required and
 * can be dropped, and remove commented-out code in typesForSelect() also.
 * Based on utils/data/groups.js : noGroup.
 */
const noType = EmberObject.create({id : 'noType', name : ''});

//------------------------------------------------------------------------------


export default Component.extend({
  apiServers: service(),
  dataset : service('data/dataset'),

  didInsertElement: on('didInsertElement', function() {
    let confirmButton = $('button[name=confirm]', this.element);
    $('input[name=password]', this.element).keyup(function(event) {
        if (event.keyCode == 13) {
            confirmButton.click();
        }
    });
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
            if (this.typeIsGerminate) {
              server.parentName = this.datasetSelected.id;
              dLog(fnName, server);
            }
            this.close();
          })
          .catch((error) => {
            let
            errorText = error ?
              (typeof error === "object") && 
              (Object.entries(error).map((kv) => kv.join(' : ')).join(', '))
              || '' + error : '' + error;
            this.set('errorText', '' + errorText); });
      }
    }
  },

  close : function() {
    dLog('close');
    this.closeNewDatasourceModal();
  },

  //----------------------------------------------------------------------------

  typeSelected : undefined,
  typeIsGerminate : computed('typeSelected', function () {
    return this.typeSelected.id === 'Germinate';
  }),

  typesForSelect : computed(function () {
    const
    fnName = 'typesForSelect',
    types = ['Pretzel', 'Germinate' /*, 'noType'*/]
      .map(name => ({id : name, name}));
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

  /** parentDataset */
  datasetSelected : undefined,
  datasetsForSelect : computed('dataset.datasetsForType', function () {
    const
    datasets = this.get('dataset').datasetsForType('Genome', false)
      /** @param dsn  { dataset, serverName } */
      .map(dsn => { const name = dsn.dataset.name; return {id : name, name}; });
    return datasets;
  }),

  selectedDatasetChanged(selectedDataset) {
    /* selectedDataset (parent) is required to have a defined value,
     * so this won't be needed.
    if (selectedDataset === noDataset) {
      selectedDataset = null;
    }
    */
    this.set('datasetSelected', selectedDataset);
  },

  //----------------------------------------------------------------------------

});
