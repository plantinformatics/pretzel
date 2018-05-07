import Ember from 'ember';

const { Component, inject: { service } } = Ember;

export default Component.extend({
  store: service(),
  style: 'height:100%; width:100%',
  attributeBindings: ['style:style'],

  selectedBlock: null,

  didInsertElement() {
    let tableDiv = $("#observational-table")[0];
    let table = new Handsontable(tableDiv, {
      data: [],
      readOnly: true,
      rowHeaders: true,
      manualRowResize: true,
      manualColumnResize: true,
      manualColumnMove: true,
      contextMenu: true,
      sortIndicator: true,
      columnSorting: true,
      stretchH: 'all',
      cells: function(row, col, prop) {
        let cellProperties = {};
        cellProperties.renderer = 'defaultRenderer';
        return cellProperties;
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
  data: Ember.computed('rows', 'displayData.[]', 'selectedBlock', function() {
    let rows = this.get('rows');
    let individuals = this.get('displayData');
    let selectedIndividual = this.get('selectedBlock');

    let data = [];
    if (selectedIndividual == null) {
      rows.forEach(function(row_name) {
        let d  = {};
        individuals.forEach(function(individual) {
          let individual_str = individual.get('datasetId').get('id') + ':' + individual.get('name');
          d[individual_str] = "";
          individual.get('features').toArray().forEach(function(feature) {
            if (feature.get('name') == row_name) {
              d[individual_str] = feature.get('value');
            }
          });
        });
        data.push(d);
      });
    } else {
      let individual_vals = {};
      rows.forEach(function(row_name) {
        individual_vals[row_name] = "";
        selectedIndividual.get('features').toArray().forEach(function(feature) {
          if (feature.get('name') == row_name) {
            individual_vals[row_name] = feature.get('value');
          }
        });
      });

      rows.forEach(function(row_name) {
        let d = {};
        individuals.forEach(function(ind) {
          let ind_str = ind.get('datasetId').get('id') + ':' + ind.get('name');
          d[ind_str] = "";
          ind.get('features').toArray().forEach(function(feature) {
            if (feature.get('name') == row_name) {
              d[ind_str] = (feature.get('value') === individual_vals[row_name])? 'A' : 'B';
            }
          })
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
      if (block == selectedBlock) {
        selectedBlock = null;
      } else {
        selectedBlock = block;
      }
      this.set('selectedBlock', selectedBlock);
      $("ul#display-blocks > li").removeClass("selected");
      if (selectedBlock != null) {
        $('ul#display-blocks > li[data-chr-id="' + selectedBlock.id + '"]').addClass("selected");
      }
    }
  }
});
