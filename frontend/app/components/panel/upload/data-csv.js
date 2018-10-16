import UploadBase from './data-base'

export default UploadBase.extend({
  loadDatasets: function(id) {
    var that = this;
    let datasets = that.get('store').peekAll('Dataset').toArray();
    if (datasets.length == 0) {
      // in case datasets haven't been loaded in yet, load them and refresh the list of datasets
      that.get('store').query('Dataset', {filter: {'include': 'blocks'}}).then(function(data) {
        if (data.toArray().length > 0) {
          that.loadDatasets();
        }
      });
    }

    //build dataset select
    $("#dataset").html('');
    $("#dataset").append($('<option>', {
      text: 'new'
    }));
    $.each(datasets, function (i, item) {
      $('#dataset').append($('<option>', {
          text : item.get('name')
      }));
    });
    if (id) {
      $("#dataset").val(id);
    }
    $("#dataset").trigger('change');

    //build parent select
    $("#parent").html('');
    $("#parent").append($('<option>', {
      value: '',
      text: 'None'
    }));
    $.each(datasets, function (i, item) {
      $('#parent').append($('<option>', {
          text : item.get('name')
      }));
    });
  },

  buildView: function() {
    var that = this;

    that.loadDatasets();
    $(function() {
      $("#dataset").on('change', function() {
        var selectedMap = $("#dataset").val();
        if (selectedMap == 'new') {
          $("#new_dataset_options").show();
        } else {
          $("#new_dataset_options").hide();
        }
        that.checkBlocks();
      });
      $('#parent').on('change', function() {
        that.checkBlocks();
      });

      var table = new Handsontable($("#hotable")[0], {
        data: [['', '', '']],
        minRows: 20,
        rowHeaders: true,
        colHeaders: true,
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
          that.checkBlocks();
        },
        afterRemoveRow: function() {
          that.checkBlocks();
        }
      });
      that.set('table', table);

      $('.nav-tabs a[href="#left-panel-upload"]').on('shown.bs.tab', function(e) {
        // trigger rerender when tab is shown
        table.updateSettings({});
      });
    });
  }.on('didInsertElement'),

  checkBlocks() {
    var that = this;
    let table = that.get('table');
    var warning = null;
    if (table != null) {
      var maps = that.get('store').peekAll('Dataset').toArray();
      if (maps) {
        // find selected dataset
        var selectedMap = $("#dataset").val();
        var map = null;
        let parent = null;
        maps.forEach(function(m) {
          if (m.get('name') == selectedMap) {
            map = m;
          }
        });
        if (map) {
          // find duplicate blocks
          let blocks = {};
          map.get('blocks').forEach(function(block) {
            blocks[block.get('name')] = false;
          });
          let data = table.getSourceData();
          var found = false;
          data.forEach(function(row) {
            if (row.block && row.block in blocks) {
              blocks[row.block] = true;
              found = true;
            }
          });
          if (found) {
            //build warning msg
            var duplicates = [];
            Object.keys(blocks).forEach(function(block) {
              if (blocks[block]) {
                duplicates.push(block);
              }
            });
            warning = "The blocks "
            + " (" + duplicates.join(', ') + ") already exist in the selected dataset and will be overwritten by the new data";
          }

          if (map.get('parent').get('name')) {
            parent = map.get('parent');
          }
        } else if (selectedMap == 'new') {
          let parent_id = $("#parent").val();
          if (parent_id.length > 0) {
            maps.forEach(function(m) {
              if (m.get('name') == parent_id) {
                parent = m;
              }
            });
          }
        }

        // check if each block exists in the parent dataset
        if (parent) {
          let blocks = {};
          parent.get('blocks').forEach(function(b) {
            blocks[b.get('name')] = true;
          });
          let data = table.getSourceData();
          let missing = [];
          data.forEach(function(row) {
            if (row.block) {
              if (!blocks[row.block]) {
                missing.push(row.block);
              }
            }
          });
          if (missing.length > 0) {
            if (warning) {
              warning += '\n\n\n';
            } else {
              warning = '';
            }
            warning += "The blocks"
            + " (" + missing.join(', ') + ") do not exist in the parent dataset (" + parent.get('name') + ')';
          }
        }
      }
    }
    that.setProperties({
      warningMessage: warning,
      successMessage: null,
      errorMessage: null
    });
  },

  getDatasetId() {
    var that = this;
    let datasets = that.get('store').peekAll('Dataset').toArray();
    return new Ember.RSVP.Promise(function(resolve, reject) {
      var selectedMap = $("#dataset").val();
      if (selectedMap != 'new') {
        resolve(selectedMap);
      } else {
        var newMap = $("#dataset_new").val();
        //check if duplicate
        datasets.forEach(function(dataset) {
          if (dataset.get('name') == newMap) {
            selectedMap = dataset.id;
            resolve(selectedMap);
          }
        });
        if (selectedMap == 'new') {
          let parentId = $("#parent").val();
          let parent = null;
          if (parentId.length > 0) {
            datasets.forEach(function(dataset) {
              if (dataset.get('name') == parentId) {
                parent = dataset;
              }
            });
          }
          let newDataset = that.get('store').createRecord('Dataset', {
            name: newMap,
            type: $("#type").val(),
            blocks: []
          });
          if (parent != null) {
            newDataset.set('parent', parent);
          }
          newDataset.save().then(function() {
            that.loadDatasets(newDataset.id)
            resolve(newDataset.id)
          })
        }
      }
    })
  },

  validateData(sourceData) {
    var that = this;
    return new Ember.RSVP.Promise(function(resolve, reject) {
      var validatedData = [];
      var cols = {};
      var table = that.get('table');
      for (var i=0; i<table.countCols(); i++) {
        var prop = table.colToProp(i);
        cols[prop] = i;
      }
      for (var i=0; i<sourceData.length; i++) {
        var row = sourceData[i];
        if (row[cols['val']] || row[cols['name']] || row[cols['block']]) {
          if (!row[cols['val']] && row[cols['val']] != 0) {
            reject({r: i, c: cols['val'], msg: 'Position required'});
            break;
          }
          if (isNaN(row[cols['val']])) {
            reject({r: i, c: cols['val'], msg: 'Position must be numeric'});
            break;
          }
          if (!row[cols['name']]) {
            reject({r: i, c: cols['name'], msg: 'Feature name required'});
            break;
          }
          if (!row[cols['block']]) {
            reject({r: i, c: cols['block'], msg: 'Block required'});
            break;
          }
          validatedData.push({
            name: row[cols['name']],
            block: row[cols['block']],
            val: row[cols['val']]
          });
        }
      }
      resolve(validatedData);
    });
  },

  actions: {
    changeFilter: function(f) {
      this.set('filter', f)
    },
    uploadBlocks() {
      var that = this;
      var table = that.get('table');
      var dataset_id = null;
      that.validateData(table.getData())
      .then(function(features) {
        if (features.length > 0) {
          that.getDatasetId().then(function(map_id) {
            var data = {dataset_id: map_id, features: features, namespace: $("#namespace").val()};
            that.set('isProcessing', true);
            that.get('auth').tableUpload(data)
            .then(function(res){
              that.setProperties({
                isProcessing: false,
                successMessage: res.status,
                errorMessage: null,
                warningMessage: null
              })
              $("body").animate({ scrollTop: 0 }, "slow");
            }, function(err, status) {
              that.setProperties({
                isProcessing: false,
                successMessage: null,
                errorMessage: err.responseJSON.error.message,
                warningMessage: null
              })
              console.log(err);
              $("body").animate({ scrollTop: 0 }, "slow");
            });
          });
        }
      }, function(err) {
        table.selectCell(err.r, err.c);
        that.set('errorMessage', err.msg);
        $("body").animate({ scrollTop: 0 }, "slow");
      });
    },
    clearTable() {
      $("#tableFile").val('');
      var table = this.get('table');
      table.updateSettings({data:[]});
    },
    uploadToTable(e) {
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
            if (rows[0].split(',').length > 0) {
              csv = true;
            }
          }
          var cols = [];
          for (var i=0; i<table.countCols(); i++) {
            var prop = table.colToProp(i);
            cols[i] = prop;
          }
          var data = [];
          rows.forEach(function(row) {
            var row_array = row.split(csv? ',': '\t');
            var row_obj = {};
            for (var i=0; i<row_array.length; i++) {
              row_obj[cols[i] || i] = row_array[i];
            }
            data.push(row_obj);
          });
          table.loadData(data);
        }
        reader.readAsText(file);
      }
    }
  }
});
