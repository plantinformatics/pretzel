import Ember from 'ember';

const { inject: { service }, Component } = Ember;

export default Component.extend({
  session: service('session'),
  auth: service('auth'),

  loadGeneticmaps: function(id) {
    var that = this;
    this.get('auth').getChromosomes().then(function(res) {
      that.set('geneticmaps', res);
      $("#geneticmap").html('');
      $.each(res, function (i, item) {
        $('#geneticmap').append($('<option>', { 
            value: item.id,
            text : item.name
        }));
      });
      if (id) {
        $("#geneticmap").val(id);
      }
      $("#geneticmap").append($('<option>', {
        value: 'new',
        text: 'new'
      }));
      $("#geneticmap").trigger('change');
    });
  },

  onInit: function() {
    var that = this;

    that.loadGeneticmaps();
    $(function() {
      $("#geneticmap").on('change', function() {
        var selectedMap = $("#geneticmap").val();
        if (selectedMap == 'new') {
          $("#geneticmap_new").show();
        } else {
          $("#geneticmap_new").hide();
        }
        that.checkChromosomes();
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
            data: 'chrom',
            type: 'text'
          },
          {
            data: 'pos',
            type: 'numeric'
          }
        ],
        colHeaders: [
          'Marker / Gene',
          'Chromosome',
          'Position'
        ],
        // width: 500,
        height: 500,
        stretchH: 'all',
        manualRowResize: true,
        manualColumnResize: true,
        manualRowMove: true,
        manualColumnMove: true,
        contextMenu: true,
        afterChange: function() {
          that.checkChromosomes();
        },
        afterRemoveRow: function() {
          that.checkChromosomes();
        }
      });
      that.set('table', table);
    });
  }.on('init'),

  checkChromosomes() {
    var that = this;
    var maps = that.get('geneticmaps');
    var warning = null;
    if (maps) {
      // find selected geneticmap
      var selectedMap = $("#geneticmap").val();
      var map = null;
      maps.forEach(function(m) {
        if (m.id == selectedMap) {
          map = m;
        }
      });
      if (map) {
        // find duplicate chromosomes
        var chromosomes = {};
        map.chromosomes.forEach(function(chrom) {
          chromosomes[chrom.name] = false;
        });
        var data = that.get('table').getSourceData();
        var found = false;
        data.forEach(function(row) {
          if (row.chrom && row.chrom in chromosomes) {
            chromosomes[row.chrom] = true;
            found = true;
          }
        });
        if (found) {
          //build warning msg
          var duplicates = [];
          Object.keys(chromosomes).forEach(function(chrom) {
            if (chromosomes[chrom]) {
              duplicates.push(chrom);
            }
          });
          warning = "The chromosome"  + (duplicates.length > 1? "s":"")
           + " (" + duplicates.join(', ') + ") already exist in the selected geneticmap and will be overwritten by the new data";
        }
      }
    }
    that.setProperties({
      warningMessage: warning,
      successMessage: null,
      errorMessage: null
    });
  },

  getGeneticmapId() {
    var that = this;
    return new Ember.RSVP.Promise(function(resolve, reject) {
      var selectedMap = $("#geneticmap").val();
      if (selectedMap != 'new') {
        resolve(selectedMap);
      } else {
        var newMap = $("#geneticmap_new").val();
        //check if duplicate
        that.get('geneticmaps').forEach(function(geneticmap) {
          if (geneticmap.name == newMap) {
            selectedMap = geneticmap.id;
            resolve(selectedMap);
          }
        });
        if (selectedMap == 'new') {
          that.get('auth').createGeneticmap(newMap)
          .then(function(res) {
            that.loadGeneticmaps(res.id);
            resolve(res.id);
          });
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
        if (row[cols['pos']] || row[cols['name']] || row[cols['chrom']]) {
          if (!row[cols['pos']] && row[cols['pos']] != 0) {
            reject({r: i, c: cols['pos'], msg: 'Position required'});
            break;
          }
          if (isNaN(row[cols['pos']])) {
            reject({r: i, c: cols['pos'], msg: 'Position must be numeric'});
            break;
          }
          if (!row[cols['name']]) {
            reject({r: i, c: cols['name'], msg: 'Marker / Gene name required'});
            break;
          }
          if (!row[cols['chrom']]) {
            reject({r: i, c: cols['chrom'], msg: 'Chromosome required'});
            break;
          }
          validatedData.push({
            name: row[cols['name']],
            chrom: row[cols['chrom']],
            pos: row[cols['pos']]
          });
        }
      }
      resolve(validatedData);
    });
  },

  actions: {
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
              successMessage: "Geneticmap data uploaded successfully!",
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
    upload(e) {
      let files = e.target.files;
      this.set('file', null);
      if (files.length > 0) {
        this.set('file', files[0]);
      }
    },
    uploadChromosomes() {
      var that = this;
      var table = that.get('table');
      var geneticmap_id = null;
      that.validateData(table.getData())
      .then(function(markers) {
        if (markers.length > 0) {
          that.getGeneticmapId().then(function(map_id) {
            var data = {geneticmap_id: map_id, markers: markers};
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
