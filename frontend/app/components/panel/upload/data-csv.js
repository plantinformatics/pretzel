import UploadBase from './data-base'

export default UploadBase.extend({
  loadDatasets: function(id) {
    var that = this;
    this.get('auth').getBlocks()
    .then(function(res) {
      that.set('datasets', res);
      $("#dataset").html('');
      $.each(res, function (i, item) {
        $('#dataset').append($('<option>', { 
            value: item.id,
            text : item.name
        }));
      });
      if (id) {
        $("#dataset").val(id);
      }
      $("#dataset").append($('<option>', {
        value: 'new',
        text: 'new'
      }));
      $("#dataset").trigger('change');
    });
  },

  onInit: function() {
    var that = this;

    that.loadDatasets();
    $(function() {
      $("#dataset").on('change', function() {
        var selectedMap = $("#dataset").val();
        if (selectedMap == 'new') {
          $("#dataset_new").show();
        } else {
          $("#dataset_new").hide();
        }
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
            type: 'numeric'
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
    });
  }.on('init'),

  checkBlocks() {
    var that = this;
    var maps = that.get('datasets');
    var warning = null;
    if (maps) {
      // find selected dataset
      var selectedMap = $("#dataset").val();
      var map = null;
      maps.forEach(function(m) {
        if (m.id == selectedMap) {
          map = m;
        }
      });
      if (map) {
        // find duplicate blocks
        var blocks = {};
        map.blocks.forEach(function(block) {
          blocks[block.name] = false;
        });
        var data = that.get('table').getSourceData();
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
          warning = "The block "  + (duplicates.length > 1? "s":"")
           + " (" + duplicates.join(', ') + ") already exist in the selected dataset and will be overwritten by the new data";
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
    return new Ember.RSVP.Promise(function(resolve, reject) {
      var selectedMap = $("#dataset").val();
      if (selectedMap != 'new') {
        resolve(selectedMap);
      } else {
        var newMap = $("#dataset_new").val();
        //check if duplicate
        that.get('datasets').forEach(function(dataset) {
          if (dataset.name == newMap) {
            selectedMap = dataset.id;
            resolve(selectedMap);
          }
        });
        if (selectedMap == 'new') {
          let newDataset = that.get('store').createRecord('Dataset', {
            name: newMap
          })
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
    submitForm() {
      let f = this.get('file');
      if (f && !this.get('isProcessing')) {
        let reader = new FileReader();
        var that = this;
        reader.onload = function(e) {
          let data = {data: reader.result, fileName: f.name};
          that.get('auth').uploadData(data)
          .then(function(res){
            that.setProperties({
              isProcessing: false, 
              successMessage: "Dataset uploaded successfully!",
              errorMessage: null
            });
            $("body").animate({ scrollTop: 0 }, "slow");
          }, function(err, status) {
            console.log(err.responseJSON.error);
            that.setProperties({
              isProcessing: false, 
              errorMessage: err.responseJSON.error.message,
              successMessage: null
            });
            $("body").animate({ scrollTop: 0 }, "slow");
          });
        }
        reader.readAsBinaryString(f);
        this.setProperties({
          isProcessing: true
        })
      }
    },
    uploadBlocks() {
      var that = this;
      var table = that.get('table');
      var dataset_id = null;
      that.validateData(table.getData())
      .then(function(features) {
        if (features.length > 0) {
          that.getDatasetId().then(function(map_id) {
            var data = {dataset_id: map_id, features: features};
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
