import Ember from 'ember';

const { Component, inject: { service } } = Ember;

export default Component.extend({
  store: service(),
  style: 'height:100%; width:100%',
  attributeBindings: ['style:style'],

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
      stretchH: 'all'
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

  updateTable: function() {
    let individuals = this.get('displayData');
    let t = $("#observational-table");
    let rows = this.get('rows');
    let rowHeaderWidth = this.get('rowHeaderWidth');
    let table = this.get('table');

    let data = [];
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
  }.observes('rows', 'displayData.[]'),
  
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
    }
  }
});
