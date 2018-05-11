import Ember from 'ember';
import DS from 'ember-data';
import attr from 'ember-data/attr';
// import { PartialModel, partial } from 'ember-data-partial-model/utils/model';

export default DS.Model.extend({
  datasetId: DS.belongsTo('dataset'),
  annotations: DS.hasMany('annotation', { async: false }),
  intervals: DS.hasMany('interval', { async: false }),
  features: DS.hasMany('feature', { async: false }),
  range: attr('array'),
  scope: attr('string'),
  name: attr('string'),
  featureType: attr('string'),


  /** true when the block is displayed in the graph.
   * set by adding the block to the graph (addMap),
   * and cleared by removing the block from the display.
   */
  isViewed: false,
  /** when a block is selected, it is highlighted wherever it is displayed, and
   * it is used as the identifier for the block being edited in the panel
   * manage-block.hbs
   *
   * isSelected is set by clicking on the element containing the block name, in
   * the 'Aligned Maps' panel/manage-view.hbs, (map) Explorer panel at left -
   * panel/manage-explorer.hbs, and also by brushing an axis in the draw-map
   * component (can have multiple axes brushed, only the most recent one is
   * 'selected').
   */
  isSelected: false

});
