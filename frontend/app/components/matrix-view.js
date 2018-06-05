import Ember from 'ember';

const { Component, inject: { service } } = Ember;

export default Component.extend({
  store: service(),
  style: 'height:100%; width:100%',
  attributeBindings: ['style:style'],
  numericalData: true,

  selectedBlock: null,

  didInsertElement() {
    let me = this;

    let tableDiv = $("#observational-table")[0];
    let table = new Handsontable(tableDiv, {
      data: [],
      readOnly: true,
      rowHeaders: true,
      manualColumnMove: true,
      height: '100%',
      colWidths: 25,
      stretchH: 'none',
      cells: function(row, col, prop) {
        let cellProperties = {};
        let selectedBlock = me.get('selectedBlock');
        let numericalData = me.get('numericalData');
        if (numericalData) {
          cellProperties.renderer = 'numericalDataRenderer';
        } else if (selectedBlock == null) {
          cellProperties.renderer = 'CATGRenderer';
        } else {
          cellProperties.renderer = 'ABRenderer';
        }
        return cellProperties;
      },
      afterOnCellMouseDown: function(event, coords, td) {
        if (coords.row == -1) {
          let col_name = $(td).find('span').text();
          me.send('selectBlock', me.get('columns')[col_name]);
        }
      }
    });
    Handsontable.renderers.registerRenderer('CATGRenderer', function(instance, td, row, col, prop, value, cellProperties) {
      Handsontable.renderers.TextRenderer.apply(this, arguments);
      if (value == 'A') {
        td.style.background = 'green';
        td.style.color = 'white';
      } else if (value == 'C') {
        td.style.background = 'blue';
        td.style.color = 'white';
      } else if (value == 'G' || value == 'B') {
        td.style.background = 'red';
        td.style.color = 'white';
      } else if (value == 'T') {
        td.style.background = 'black';
        td.style.color = 'white';
      }
    });

    Handsontable.renderers.registerRenderer('ABRenderer', function(instance, td, row, col, prop, value, cellProperties) {
      Handsontable.renderers.TextRenderer.apply(this, arguments);
      let abValues = me.get('abValues');
      if (value != null && abValues[row] != null) {
        if (value == abValues[row]) {
          td.style.background = 'green';
          td.style.color = 'white';
          $(td).text('A');
        } else {
          td.style.background = 'red';
          td.style.color = 'white';
          $(td).text('B');
        }
      }
    });

    Handsontable.renderers.registerRenderer('numericalDataRenderer', function(instance, td, row, col, prop, value, cellProperties) {
      Handsontable.renderers.TextRenderer.apply(this, arguments);
      let row_ranges = me.get('rowRanges')

      if (!isNaN(value)) {
        let color_scale = d3.scaleLinear().domain(row_ranges[row])
          .interpolate(d3.interpolateHsl)
          .range([d3.rgb("#0000FF"), d3.rgb('#FFFFFF'), d3.rgb('#FF0000')]);
        td.style.background = color_scale(value);
        td.title = value;
        $(td).css('font-size', 10);
      }
    });

    this.set('table', table);
    this.set('displayData', []);
  },

  displayData: [],
  noData: Ember.computed('displayData.[]', function() {
    let d = this.get('displayData');
    return d.length == 0;
  }),
  columns: Ember.computed('displayData.[]', function() {
    let data = this.get('displayData');
    let cols = {};
    data.forEach(function(d) {
      let col_name = d.get('datasetId').get('id') + ':' + d.get('name');
      cols[col_name] = d;
    });
    return cols;
  }),
  rowHeaderWidth: Ember.computed('rows', function() {
    let rows = this.get('rows');
    let longest_row = 0;
    let length_checker = $("#length_checker");
    rows.forEach(function(r) {
      let w = length_checker.text(r).width();
      if (w > longest_row) {
        longest_row = w;
      }
    })
    return longest_row + 10;
  }),
  colHeaderHeight: Ember.computed('columns', function() {
    let cols = this.get('columns');
    let longest_row = 0;
    let length_checker = $("#length_checker");
    length_checker.css('font-weight', 'bold');
    Object.keys(cols).forEach(function(col_name) {
      let w = length_checker.text(col_name).width();
      if (w > longest_row) {
        longest_row = w;
      }
    });
    return longest_row + 20;
  }),
  dataByRow: Ember.computed('displayData.[]', function() {
    let nonNumerical = false;
    let rows = {}
    let cols = this.get('columns');
    Object.keys(cols).forEach(function(col_name) {
      let col = cols[col_name];
      col.get('features').forEach(function(feature) {
        let feature_name = feature.get('name');
        if (rows[feature_name] == null) {
          rows[feature_name] = {};
        }
        rows[feature_name][col_name] = feature.get('value');
        
        if (isNaN(feature.get('value'))) {
          nonNumerical = true;
        }
      });
    });
    this.set('numericalData', !nonNumerical);
    return rows;
  }),
  rows: Ember.computed('dataByRow', function() {
    let data = this.get('dataByRow');
    return Object.keys(data);
  }),
  abValues: Ember.computed('dataByRow', 'selectedBlock', function() {
    let data = this.get('dataByRow');
    let selectedBlock = this.get('selectedBlock');
    let values = [];

    if (selectedBlock != null) {
      let col_name = selectedBlock.get('datasetId').get('id') + ':' + selectedBlock.get('name');
      Object.keys(data).forEach(function(row_name) {
        values.push(data[row_name][col_name]);
      });
    }
    return values;
  }),
  data: Ember.computed('displayData.[]', function() {
    let cols = this.get('columns');
    let rows = this.get('rows');
    let dataByRow = this.get('dataByRow');

    let data = [];
    rows.forEach(function(row_name) {
      let d  = {};
      Object.keys(cols).forEach(function(col_name) {
        d[col_name] = dataByRow[row_name][col_name];
      });
      data.push(d);
    });
    return data;
  }),
  rowRanges: Ember.computed('dataByRow', function() {
    let data = this.get('dataByRow');

    let all_values = {};
    Object.keys(data).forEach(function(row_name) {
      let row = data[row_name];
      if (all_values[row_name] == null) {
        all_values[row_name] = [];
      }
      Object.keys(row).forEach(function(col_name) {
        all_values[row_name].push(row[col_name]);
      });
    });

    let ranges = [];
    Object.keys(all_values).forEach(function(row_name) {
      let row = all_values[row_name];
      let min = Infinity;
      let max = -Infinity;
      let avg = 0;
      let sum = 0;
      row.forEach(function(x) {
        sum += x;
        if (x < min) {
          min = x;
        }
        if (x > max) {
          max = x;
        }
      });
      avg = sum / row.length;
      ranges.push([min, avg, max]);
    });
    return ranges;        
  }),

  updateTable: function() {
    let t = $("#observational-table");
    let rows = this.get('rows');
    let rowHeaderWidth = this.get('rowHeaderWidth');
    let colHeaderHeight = this.get('colHeaderHeight');
    let table = this.get('table');
    let data = this.get('data');

    if (data.length > 0) {
      t.show();
      let columns = Object.keys(data[0]);
      columns = columns.map(function(x) {
        return '<div class="head">' + x + '</div>';
      });

      for(let i=0; i<2; i++) {
        table.updateSettings({
          colHeaders: columns,
          rowHeaders: rows,
          rowHeaderWidth: rowHeaderWidth,
          columnHeaderHeight: colHeaderHeight,
          data: data
        });
      }
    } else {
      t.hide();
    }
  }.observes('displayData.[]', 'selectedBlock'),
  
  actions: {
    toggleLeftPanel() {
      $(".left-panel-shown").toggle();
      $(".left-panel-hidden").toggle();
    },
    loadBlock(block) {
      let data = this.get('displayData');
      let store = this.get('store');
      store.findRecord('block', block.id, {
          reload: true,
          adapterOptions: {filter: {'include': 'features'}}
      }).then(function(b)  {
        if (!data.includes(b)) {
          data.pushObject(b);
        }
      });
    },
    removeBlock(block) {
      let data = this.get('displayData');
      if (data.includes(block)) {
        data.removeObject(block);
      }
    },
    selectBlock(block) {
      let selectedBlock = this.get('selectedBlock');
      let table = this.get('table');
      if (block == selectedBlock) {
        selectedBlock = null;
      } else {
        selectedBlock = block;
      }
      this.set('selectedBlock', selectedBlock);
      $("ul#display-blocks > li").removeClass('selected');
      $('#matrix-view').find('table').find('th').find('span').removeClass('selected');
      if (selectedBlock != null) {
        $('ul#display-blocks > li[data-chr-id="' + selectedBlock.id + '"]').addClass("selected");
        let col_name = selectedBlock.get('datasetId').get('id') + ':' + selectedBlock.get('name');
        table.selectColumns(col_name);
        $('#matrix-view').find('table').find('th').find('span:contains("' + col_name + '")').addClass('selected');
      }
    }
  }
});
