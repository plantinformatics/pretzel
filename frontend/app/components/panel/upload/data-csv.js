import { debounce, later as run_later } from '@ember/runloop';
import { observer, computed } from '@ember/object';
import { Promise } from 'rsvp';
import { alias } from '@ember/object/computed';
import { inject as service } from '@ember/service';

const dLog = console.debug;

import UploadBase from './data-base';
import uploadTable from '../../../utils/panel/upload-table';


import config from '../../../config/environment';

/*----------------------------------------------------------------------------*/

/** Identify the columns of getData().
 *
 * Prior to update from handsontable 7 -> 8, the row data was presented as {name, block, val}.
 * These column indexes are used as row[c_name], so to use handsontable 7, 
 * c_name = 'name', c_block = 'block', c_val = 'block';
 */
const c_name = 0, c_block = 1, c_val = 2, c_end = 3;

/*----------------------------------------------------------------------------*/

/* global Handsontable */
/* global FileReader */

export default UploadBase.extend({
  apiServers: service(),
  /** If server may be given, then lookup as is done in
   * services/data/dataset.js using apiServers (this can be factored into
   * components/service/api-server.js) */
  store : alias('apiServers.primaryServer.store'),

  /*--------------------------------------------------------------------------*/

  /** true means view the blocks of the dataset after it is added.
   * Used in upload-table.js : submitFile().
   */
  viewDatasetFlag : false,

  /*--------------------------------------------------------------------------*/

  table: null,
  selectedDataset: 'new',
  newDatasetName: '',
  nameWarning: null,
  selectedParent: '',
  dataType: 'linear',
  namespace: '',

  /*--------------------------------------------------------------------------*/

  /** these functions were factored to form upload-table.js */
  getDatasetId : uploadTable.getDatasetId,
  isDupName : uploadTable.isDupName,
  onNameChange : observer('newDatasetName', uploadTable.onNameChange),
  onSelectChange : observer('selectedDataset', 'selectedParent', uploadTable.onSelectChange),

  /*--------------------------------------------------------------------------*/

  didInsertElement() {
    this._super(...arguments);
  },

  activeEffect : computed('active', function () {
    let active = this.get('active');
    if (active) {
      this.shownBsTab();
    }
  }),
  /** Called when user clicks on nav tab of Upload panel.
   * action is now used in instead of listening for .on('shown.bs.tab'); the
   * bs.tab events are probably no longer available since using ember-bootstrap
   * because .active is set by ember when the route matches the <a href>, refn :
   * https://guides.emberjs.com/release/routing/linking-between-routes/#toc_active-css-class
   *
   * bootstrap/js/tab.js : show() will return without doing
   * $this.trigger(showEvent) if li.hasClass('active'); also note show() is only
   * called if <nav.item> <a> has data-toggle="tab".
   */
  shownBsTab() {
    /** Both .createTable() and .updateSettings() require a delay.
     * Without this delay the table is not displayed because this element has
     * 0px height & width :
     *  div#hotable > div.ht_master.handsontable > div.wtHolder */
    run_later(() => this.showTable(), 500);
  },
  showTable() {
    // Ensure table is created when tab is shown
    let table = this.get('table');
    if (! table) {
      this.createTable();
    } else {
      // trigger rerender when tab is shown
      table.updateSettings({});
    }
  },

  createTable() {
    dLog('createTable');
    var that = this;
    $(function() {
      let hotable = $("#hotable")[0];
      if (! hotable) {
        console.warn('upload/data-csv : #hotable not found', that);
        return;  // fail
      }
      var table = new Handsontable(hotable, {
        data: [['', '', '', '']],
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
          },
          {
            data: 'end',
            type: 'numeric',
            numericFormat: {
              pattern: '0,0.*'
            }
          }
        ],
        colHeaders: [
          'Feature',
          'Block',
          'Position',
          'End'
        ],
        height: 500,
        colWidths: [100, 100, 100, 100],
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
        /** Previously getSourceData() was used, but that is now
         * returning the (empty) initial data.  Not sure how it worked
         * before (probably change is related to recent update of
         * handsOnTable from 7 to 8 (7.4.2 -> 8.2.0).
         * getData() seems like the logical function to use, and it works.
         */
        let data = table.getData();
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
              if (row[c_block]) {
                if (row[c_block] in blocks) {
                  result[row[c_block]] = true;
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
            if (row[c_block]) {
              if (!(row[c_block] in parentBlocks)) {
                result[row[c_block]] = true;
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


  /** Checks uploaded table data for any missing or invalid elements.
   *  Returns same data, with 'val' cast as numeric */
  validateData() {
    var that = this;
    return new Promise(function(resolve, reject) {
      let table = that.get('table');
      if (table === null) {
        resolve([]);
      }
      /** was getSourceData() - see comment in checkBlocks(). */
      let sourceData = table.getData();
      var validatedData = [];
      sourceData.every((row, i) => {
        if (row[c_val] || row[c_name] || row[c_block]) {
          if (!row[c_val] && row[c_val] !== 0) {
            reject({r: i, c: 'val', msg: `Position required on row ${i+1}`});
            return false;
          }
          if (isNaN(row[c_val])) {
            reject({r: i, c: 'val', msg: `Position must be numeric on row ${i+1}`});
            return false;
          }
          /** if the end column is empty, row[c_end] === null; using '== null' handles undefined also. */
          /*jshint eqnull:true */
          const endEmpty = row[c_end] == null;
          if (! endEmpty && isNaN(row[c_end])) {
            reject({r: i, c: 'end', msg: `End Position must be numeric on row ${i+1}`});
            return false;
          }
          if (!row[c_name]) {
            reject({r: i, c: 'name', msg: `Feature name required on row ${i+1}`});
            return false;
          }
          if (!row[c_block]) {
            reject({r: i, c: 'block', msg: `Block required on row ${i+1}`});
            return false;
          }
          let r = {
             name: row[c_name],
             block: row[c_block],
             // Make sure val is a number, not a string.
             val: Number(row[c_val])
          };
          if (! endEmpty) {
            r.end = +row[c_end];
          }
          validatedData.push(r);
          return true;
        }
      });
      resolve(validatedData);
    });
  },

  /*--------------------------------------------------------------------------*/

  actions: {
    submitFile : uploadTable.submitFile,
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
  /*--------------------------------------------------------------------------*/

});
