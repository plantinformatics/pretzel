import Ember from 'ember';

// import Handsontable from 'handsontable';

export default Ember.Component.extend({

  actions : {

    /**
     * @param d array of e.g.
     * {Chromosome: "599bca87501547126adea117", Marker: "markerL", Position: "1.2"}
     */
    showData : function(d)
    {
      console.log("showData", d);
      let table = this.get('table');
      /** filter out empty rows in d[] */
      let data = d.filter(function(d1) { return d1.Chromosome; });
      table.loadData(data);
    }

  },


  didInsertElement() {
    console.log("components/table-brushed.js: didInsertElement");
  },


  didRender() {
    console.log("components/table-brushed.js: didRender");
    let table = this.get('table');
    if (table === undefined)
      this.get('createTable').apply(this);
  },
  
  createTable: function() {
    var that = this;
    console.log("createTable", this);

    let tableDiv = Ember.$("#table-brushed")[0];
    console.log("tableDiv", tableDiv);
      var table = new Handsontable(tableDiv, {
        data: [['', '', '']],
        minRows: 1,
        rowHeaders: true,
        columns: [
          {
            data: 'Chromosome',
            type: 'text'
          },
          {
            data: 'Marker',
            type: 'text'
          },
          {
            data: 'Position',
            type: 'numeric',
            format: '0.000'
          }
        ],
        colHeaders: [
          'Chromosome',
          'Marker / Gene',
          'Position'
        ],
        width: 500,
        stretchH: 'all',
        manualRowResize: true,
        manualColumnResize: true,
        manualRowMove: true,
        manualColumnMove: true,
        contextMenu: true
      });
      that.set('table', table);
  },


  onSelectionChange: function () {
    let data = this.get('data'),
    me = this,
    table = this.get('table');
    console.log("table-brushed.js", "onSelectionChange", table, data.length);
    me.send('showData', data);
    table.updateSettings({data:data});
  }.observes('data')


});
