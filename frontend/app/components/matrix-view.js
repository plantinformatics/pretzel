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
      // minRows: 0,
      rowHeaders: false,
      manualRowResize: true,
      manualColumnResize: true,
      manualRowMove: true,
      manualColumnMove: true,
      contextMenu: true,
      sortIndicator: true,
      columnSorting: true,
      stretchH: 'all'
    });
    this.set('table', table);
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

  updateTable: function() {
    let individuals = this.get('displayData');
    let t = $("#observational-table");
    let rows = this.get('rows');
    let table = this.get('table');

    let data = [];
    rows.forEach(function(row_name) {
      let d  = {"feature": row_name};
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

      table.updateSettings({
        colHeaders: columns,
        data: data
      });
      table.updateSettings({
        colHeaders: columns,
        data: data
      });
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
    }
  }
});
