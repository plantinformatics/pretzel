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
  namespace: attr('string'),


  /** true when the block is displayed in the graph.
   * set by adding the block to the graph (entry-block: get()),
   * and cleared by removing the block from the display.
   */
  isViewed: false,
  /** undefined if ! isViewed, otherwise handle of Block in Stacked axis which displays this block.
   * This attribute can split out into a mixin, in that case could merge with stacks.js : Block.
   */
  view : undefined,
  
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
  isSelected: false,

  /*--------------------------------------------------------------------------*/

  /** @return true if this block's dataset defined meta.paths and it is true.
   */
  showPaths : Ember.computed('datasetId.meta.paths', 'id', function () {
    let
    dataset = this.get('datasetId'),
    paths = dataset.get('meta.paths');
    // if no meta.paths, then default to paths : true.
    if (paths === undefined)
      paths = true;
    else if (paths == "false")
      paths = false;
    /** for testing, without setting up datasets with meta.paths : true, check
     * the parity of the 2nd last char of the block id, which is evenly even/odd.
     */
    if (false)
    {
      let id = this.get('id'),
      odd = id.charCodeAt(id.length - 2) & 0x1;
      paths |= odd;
      console.log(id, odd);
    }
    // console.log('showPaths', dataset, paths);
    return paths;
  }),

  /*--------------------------------------------------------------------------*/

  /** If the dataset of this block has a parent, return the name of that parent (reference dataset).
   * @return the reference dataset name or undefined if none
   */
  referenceDatasetName : Ember.computed('dataset', function () {
    // copied out of referenceBlock(); could be factored
    let 
      referenceBlock,
    dataset = this.get('datasetId'),
    reference = dataset && dataset.get('parent'),
    /** reference dataset */
    parent = dataset && dataset.get('parent'),
    parentName = parent && parent.get('name');  // e.g. "myGenome"

    console.log('referenceDatasetName', dataset, reference, parent, parentName, parent && parent.get('id'));

    return parentName;
  }),


  /** If the dataset of this block has a parent, lookup the corresponding reference block in that parent, matching scope.
   * @return the reference block or undefined if none
   */
  referenceBlock : Ember.computed('dataset', 'scope', function () {
    let 
      referenceBlock,
    scope = this.get('scope'),
    dataset = this.get('datasetId'),
    reference = dataset && dataset.get('parent'),
    namespace = this.get('namespace'),
    /** reference dataset */
    parent = dataset && dataset.get('parent'),
    parentName = parent && parent.get('name');  // e.g. "myGenome"

    console.log('referenceBlock', scope, dataset, reference, namespace, parent, parentName, parent && parent.get('id'));
    if (parent)
    {
      referenceBlock = this.get('store').peekAll('block')
        .filter(function (b) {
          let scope2 = b.get('scope'),
          dataset2 = b.get('datasetId'),
          /** Comparing parent === dataset2 doesn't work because one or both may
           * be promises; refer e.g. :
           *   https://discuss.emberjs.com/t/testing-for-record-equality-in-ember-data/11433/3
           * Matching the objects directly seems slightly better than matching
           * by name, although .datasetId may be replaced by name - currently
           * being considered.
           */
          match = (parentName == dataset2.get('name')) && (scope2 == scope);
          if ((parentName == dataset2.get('name')) || (dataset2 === parent))
          {
            console.log(dataset2.get('name'), scope2, match);
          }
          return match;})
      ;
      console.log('referenceBlock', referenceBlock);
      // expect referenceBlock.length == 0 or 1
      if (referenceBlock.length !== undefined)
        referenceBlock = referenceBlock[0] || undefined;
    }
    return referenceBlock;
  })

  /*--------------------------------------------------------------------------*/

});
