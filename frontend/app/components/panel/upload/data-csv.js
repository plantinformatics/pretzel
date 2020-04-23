import Ember from 'ember';
const { inject: { service } } = Ember;

import UploadBase from './data-base';

import config from '../../../config/environment';

/* global Handsontable */
/* global FileReader */

export default UploadBase.extend({
  apiServers: service(),
  /** If server may be given, then lookup as is done in
   * services/data/dataset.js using apiServers (this can be factored into
   * components/service/api-server.js) */
  store : Ember.computed.alias('apiServers.primaryServer.store'),


  table: null,
  selectedDataset: 'new',
  newDatasetName: '',
  nameWarning: null,
  selectedParent: '',
  dataType: 'linear',
  namespace: '',

  didInsertElement() {
    this._super(...arguments);
    var that = this;
    $(function() {
      let hotable = $("#hotable")[0];
      if (! hotable) {
        console.warn('upload/data-csv : #hotable not found', that);
        return;  // fail
      }
      var table = new Handsontable(hotable, {
        data: [['', '', '']],
        minRows: 20,
        rowHeaders: true,
        columns: [
          {
            data: 'name',
            type: 'text'
          },
          {
            data: 'block',
            type: 'text'
          },
          {
            data: 'val',
            type: 'numeric',
            numericFormat: {
              pattern: '0,0.*'
            }
          }
        ],
        colHeaders: [
          'Feature',
          'Block',
          'Position'
        ],
        height: 500,
        colWidths: [100, 100, 100],
        manualRowResize: true,
        manualColumnResize: true,
        manualRowMove: true,
        manualColumnMove: true,
        contextMenu: true,
        afterChange: function() {
          that.checkData();
        },
        afterRemoveRow: function() {
          that.checkData();
        },
        /* see comment re. handsOnTableLicenseKey in frontend/config/environment.js */
        licenseKey: config.handsOnTableLicenseKey
      });
      that.set('table', table);
      $('.nav-tabs a[href="#left-panel-upload"]').on('shown.bs.tab', function() {
        // trigger rerender when tab is shown
        table.updateSettings({});
      });
    });
  },

  /** After file upload or table change, check for issues and display */
  checkData() {
    this.setError(null);
    this.isDupName();
    this.validateData().then(() => {
      this.checkBlocks();
    }, (err) => {
      let table = this.get('table');
      if(table) {
        table.selectCell(err.r, err.c);
      }
      this.setError(err.msg);
      this.scrollToTop();
    });
  },

  /** If dataset or parent selected, compares blocks of data to those of parent
   *  for duplicate or missing keys */
  checkBlocks() {
    let that = this;
    let table = that.get('table');
    let warning = null;
    if (table !== null) {
      let datasets = that.get('datasets');
      if (datasets) {
        let data = table.getSourceData();
        let map = null;
        let parent = null;
        let selectedMap = that.get('selectedDataset');
        if (selectedMap === 'new') {
          // Find parent dataset
          let parent_id = that.get('selectedParent');
          if (parent_id.length > 0) {
            parent = datasets.findBy('name', parent_id);
          }
        } else {
          // Find selected dataset
          map = datasets.findBy('name', selectedMap);
          if (map) {
            // Find duplicate blocks
            // 1. Fetch mapped dataset blocks keyed by name
            let blocks = map.get('blocks').reduce((result, block) => {
              result[block.get('name')] = true;
              return result;
            }, {});
            // 2. Find blocks duplicated in table data
            let duplicates = data.reduce((result, row) => {
              if (row.block) {
                if (row.block in blocks) {
                  result[row.block] = true;
                }
              }
              return result;
            }, {});
            if (Object.keys(duplicates).length > 0) {
              warning =
                'The blocks (' +
                Object.keys(duplicates).join(', ') +
                ') already exist in the selected dataset and will be overwritten by the new data';
            }
            // find parent dataset
            if (map.get('parent').get('name')) {
              parent = map.get('parent');
            }
          }
        }
        // check if each block exists in the parent dataset
        if (parent) {
          // 1. Fetch parent blocks keyed by name
          let parentBlocks = parent.get('blocks').reduce((result, block) => {
            result[block.get('name')] = true;
            return result;
          }, {});
          // 2. Find table data blocks missing from parent blocks
          let missing = data.reduce((result, row) => {
            if (row.block) {
              if (!(row.block in parentBlocks)) {
                result[row.block] = true;
              }
            }
            return result;
          }, {});
          if (Object.keys(missing).length > 0) {
            warning = warning ? warning + '\n\n\n' : '';
            warning +=
              'The blocks (' +
              Object.keys(missing).join(', ') +
              ') do not exist in the parent dataset (' +
              parent.get('name') +
              ')';
          }
        }
      }
    }
    if (warning) {
      that.setWarning(warning);
      that.scrollToTop();
    }
  },

  /** Returns a selected dataset name OR
   *  Attempts to create a new dataset with entered name */
  getDatasetId() {
    var that = this;
    let datasets = that.get('datasets');
    return new Ember.RSVP.Promise(function(resolve, reject) {
      var selectedMap = that.get('selectDataset');
      // If a selected dataset, can simply return it
      // If no selectedMap, treat as default, 'new'
      if (selectedMap && selectedMap !== 'new') {
        resolve(selectedMap);
      } else {
        var newMap = that.get('newDatasetName');
        // Check if duplicate name
        let matched = datasets.findBy('name', newMap);
        if(matched){
          reject({ msg: `Dataset name '${newMap}' is already in use` });
        } else {
          let newDetails = {
            name: newMap,
            type: that.get('dataType'),
            namespace: that.get('namespace'),
            blocks: []
          };
          let parentId = that.get('selectedParent');
          if (parentId && parentId.length > 0) {
            newDetails.parent = datasets.findBy('name', parentId);
          }
          let newDataset = that.get('store').createRecord('Dataset', newDetails);
          newDataset.save().then(() => {
            resolve(newDataset.id);
          });
        }
      }
    });
  },

  /** Checks uploaded table data for any missing or invalid elements.
   *  Returns same data, with 'val' cast as numeric */
  validateData() {
    var that = this;
    return new Ember.RSVP.Promise(function(resolve, reject) {
      let table = that.get('table');
      if (table === null) {
        resolve([]);
      }
      let sourceData = table.getSourceData();
      var validatedData = [];
      sourceData.every((row, i) => {
        if (row.val || row.name || row.block) {
          if (!row.val && row.val !== 0) {
            reject({r: i, c: 'val', msg: `Position required on row ${i+1}`});
            return false;
          }
          if (isNaN(row.val)) {
            reject({r: i, c: 'val', msg: `Position must be numeric on row ${i+1}`});
            return false;
          }
          if (!row.name) {
            reject({r: i, c: 'name', msg: `Feature name required on row ${i+1}`});
            return false;
          }
          if (!row.block) {
            reject({r: i, c: 'block', msg: `Block required on row ${i+1}`});
            return false;
          }
          validatedData.push({
            name: row.name,
            block: row.block,
            // Make sure val is a number, not a string.
            val: Number(row.val)
          });
          return true;
        }
      });
      resolve(validatedData);
    });
  },

  /** Checks if entered dataset name is already taken in dataset list
   *  Debounced call through observer */
  isDupName: function() {
    let selectedMap = this.get('selectedDataset');
    if (selectedMap === 'new') {
      let newMap = this.get('newDatasetName');
      let datasets = this.get('datasets');
      let matched = datasets.findBy('name', newMap);
      if(matched){
        this.set('nameWarning', `Dataset name '${newMap}' is already in use`);
        return true;
      }
    }
    this.set('nameWarning', null);
    return false;
  },
  onNameChange: Ember.observer('newDatasetName', function() {
    Ember.run.debounce(this, this.isDupName, 500);
  }),
  onSelectChange: Ember.observer('selectedDataset', 'selectedParent', function() {
    this.clearMsgs();
    this.isDupName();
    this.checkBlocks();
  }),

  actions: {
    submitFile() {
      var that = this;
      that.clearMsgs();
      that.set('nameWarning', null);
      var table = that.get('table');
      // 1. Check data and get cleaned copy
      that.validateData()
      .then((features) => {
        if (features.length > 0) {
          // 2. Get new or selected dataset name
          that.getDatasetId().then((map_id) => {
            var data = {
              dataset_id: map_id,
              features: features,
              namespace: that.get('namespace'),
            };
            that.setProcessing();
            that.scrollToTop();
            // 3. Submit upload to api
            that.get('auth').tableUpload(data, that.updateProgress.bind(that))
            .then((res) => {
              that.setSuccess(res.status);
              that.scrollToTop();
              // On complete, trigger dataset list reload
              // through controller-level function
              that.get('refreshDatasets')();
            }, (err, status) => {
              console.log(err, status);
              that.setError(err.responseJSON.error.message);
              that.scrollToTop();
              if(that.get('selectedDataset') === 'new'){
                // If upload failed and here, a new record for new dataset name
                // has been created by getDatasetId() and this should be undone
                that.get('store')
                  .findRecord('Dataset', map_id, { reload: true })
                  .then((rec) => rec.destroyRecord()
                    .then(() => rec.unloadRecord())
                  );
              }
            });
          }, (err) => {
            that.setError(err.msg);
            that.scrollToTop();
          });
        }
      }, (err) => {
        table.selectCell(err.r, err.c);
        that.setError(err.msg);
        that.scrollToTop();
      });
    },
    clearTable() {
      $("#tableFile").val('');
      var table = this.get('table');
      table.updateSettings({data:[]});
    },
    setFile(e) {
      // First call base version of this overidden function
      // which sets file property
      this._super(e);
      // Then proceed to populate display table from file parse
      let file = e.target.files[0];
      var table = this.get('table');
      if (file) {
        let reader = new FileReader();
        reader.onload = function() {
          var text = reader.result;
          text = text.replace(/"+/g, '');
          var rows = text.split('\n');
          // csv or tsv?
          var csv = false;
          if (rows[0]) {
            if (rows[0].split(',').length > 1) {
              csv = true;
            }
          }
          var cols = [];
          for (var i = 0; i < table.countCols(); i++) {
            var prop = table.colToProp(i);
            cols[i] = prop;
          }
          var data = [];
          rows.forEach((row) => {
            var row_array = row.split(csv ? ',' : '\t');
            var row_obj = {};
            for (var i = 0; i < row_array.length; i++) {
              row_obj[cols[i] || i] = row_array[i].trim();
            }
            data.push(row_obj);
          });
          table.loadData(data);
        };
        reader.readAsText(file);
      }
    }
  }
});
