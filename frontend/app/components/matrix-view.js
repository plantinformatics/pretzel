import Ember from 'ember';

const { Component, inject: { service } } = Ember;

export default Component.extend({
  store: service(),
  style: 'height:100%; width:100%',
  attributeBindings: ['style:style'],

  selectedBlock: null,

  didInsertElement() {
    let me = this;
    let tableDiv = $("#observational-table")[0];
    let table = new Handsontable(tableDiv, {
      data: [],
      readOnly: true,
      rowHeaders: true,
      manualRowResize: true,
      manualColumnResize: true,
      manualColumnMove: true,
      contextMenu: true,
      stretchH: 'all',
      cells: function(row, col, prop) {
        let cellProperties = {};
        cellProperties.renderer = 'defaultRenderer';
        return cellProperties;
      },
      afterOnCellMouseDown: function(event, coords, td) {
        if (coords.row == -1) {
          let col_name = $(td).find('span').text();
          me.send('selectBlock', me.get('columns')[col_name]);
        }
      }
    });
    Handsontable.renderers.registerRenderer('defaultRenderer', function(instance, td, row, col, prop, value, cellProperties) {
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

    this.set('table', table);
    this.set('displayData', []);
  },

  displayData: [],
  noData: Ember.computed('displayData.[]', function() {
    let d = this.get('displayData');
    return d.length == 0;
  }),
  rows: Ember.computed('displayData.[]', function() {
    let features = {};
    let data = this.get('displayData');
    data.forEach(function(d) {
      d.get('features').toArray().forEach(function(f) {
        features[f.get('name')] = true;
      });
    });
    return Object.keys(features);
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
  data: Ember.computed('displayData.[]', 'selectedBlock', function() {
    let rows = this.get('rows');
    let cols = this.get('columns');
    let selectedIndividual = this.get('selectedBlock');

    let data = [];
    if (selectedIndividual == null) {
      rows.forEach(function(row_name) {
        let d  = {};
        Object.keys(cols).forEach(function(col_name) {
          let ind = cols[col_name];
          d[col_name] = "";
          let features = ind.get('features').toArray().filter(function(x) {return x.get('name') == row_name});
          if (features.length > 0) {
            d[col_name] = features[0].get('value');
          }
        });
        data.push(d);
      });
    } else {
      let individual_vals = {};
      rows.forEach(function(row_name) {
        individual_vals[row_name] = "";
        let features = selectedIndividual.get('features').toArray().filter(function(x) {return x.get('name') == row_name});
        if (features.length > 0) {
          individual_vals[row_name] = features[0].get('value');
        }
      });

      rows.forEach(function(row_name) {
        let d = {};
        Object.keys(cols).forEach(function(col_name) {
          let ind = cols[col_name];
          d[col_name] = "";
          let features = ind.get('features').toArray().filter(function(x) {return x.get('name') == row_name});
          if (features.length > 0) {
            d[col_name] = (features[0].get('value') == individual_vals[row_name])? 'A' : 'B';
          }
        });
        data.push(d);
      });
    }
    return data;
  }),

  updateTable: function() {
    let t = $("#observational-table");
    let rows = this.get('rows');
    let rowHeaderWidth = this.get('rowHeaderWidth');
    let table = this.get('table');
    let data = this.get('data');

    if (data.length > 0) {
      t.show();
      let columns = Object.keys(data[0]);

      for(let i=0; i<2; i++) {
        table.updateSettings({
          colHeaders: columns,
          rowHeaders: rows,
          rowHeaderWidth: rowHeaderWidth,
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
