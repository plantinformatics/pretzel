import { inject as service } from '@ember/service';
import Component from '@ember/component';

// -----------------------------------------------------------------------------

const dLog = console.debug;

/** Same as in manage-view.js  */
const tab_view_prefix = "tab-view-";

// -----------------------------------------------------------------------------

/**
 * args :
 * @param changed signal to parent component when user has changed settings.
 * action call signature is : changed(settings, changedFieldName) where settings contains :
 *  {
 *    qtlColourBy : string : 'Ontology', 'Trait', 'Block',
 *    visibleByOntology : boolean,
 *    visibleByTrait : boolean,
 *  }
 * and changedFieldName is string : name of the field which changed
 * (undefined for initial / default)
 * changedFieldName is logged but otherwise not yet used.
 */
export default Component.extend({
  controls : service(),

  didRender() {
    this._super(...arguments);

    dLog('didRender');
    this.get('controls').set('viewed', this);
    /** report initial/default settings values to parent component. */
    this.changed(this);
  },

  /** Instead of settings being changed via the buttons in viewed-settings,
   * the tab selection in manage-view is now used to select .qtlColourBy,
   * .visibleByOntology, and .visibleByTrait.
   * This is enabled by .tabSetsColourByVisible
   */
  onChangeTab(id) {
    dLog('onChangeTab', id, this);
    if (this.tabSetsColourByVisible) {
      this.set('qtlColourBy', (id === 'Blocks') ? 'Block' : id);
      this.set('visibleByOntology', id === 'Ontology');
      this.set('visibleByTrait', id === 'Trait');
      dLog('onChangeTab', id, this.qtlColourBy, this.visibleByOntology, this.visibleByTrait);
    }
  },
  /** Called when the user clicks view in the Trait or Ontology tab in the
   * dataset explorer.
   * In addition to viewing the block (handled by manage-explorer : loadBlock),
   * this indicates that the View panel Trait / Ontology tab should be selected,
   * if .tabSetsColourByVisible.
   * @param field (singular)  'Trait', 'Ontology',
   */
  colourAndVisibleBy(field) {
    dLog('colourAndVisibleBy', field);
    if (this.tabSetsColourByVisible) {
      this.selectTab(field);
      /** .selectTab() triggers onChangeTab(), which sets .qtlColourBy,
       * .visibleBy{Ontology,Trait}.  (until 6fdd6ea9 this was done by
       * manage-explorer.js : colourAndVisibleBy() : setProperties()).
       */
    }
  },

  /**
   * @param name : 'Trait', 'Ontology' ('Blocks' is not used)
   */
  selectTab(name) {
    let 
    bsTab = this.parentView,
    /** match with manage-view.js:datasetTypeTabId() */
    tabName = tab_view_prefix + name;
    dLog('selectTab', tabName, 'bsTab', bsTab._debugContainerKey);
    // expect (bsTab._debugContainerKey === "component:bs-tab")
    bsTab.select(tabName);
  },

  /** Colour QTL diamonds & <rect>s by one of : Ontology, Trait, Block. */
  qtlColourBy : 'Block',
  qtlColourByChanged(value) {
    dLog('qtlColourByChanged', value);
    this.changed(this, 'qtlColourBy');
  },



  /** the data/ontology and data/trait services provide .featureFilter(), used
   * by axis-tracks : tracksTree() to filter out QTLs whose
   * .values.{Trait,Ontology} is not set to be visible.  If the value is not
   * defined, then it is filtered out if this flag is true (otherwise it is
   * filtered in/out according to the set visibility of the value).
   * That is, the flag indicates if a value is required; if false then QTLS with
   * undefined values are displayed.
   * QTLs with undefined Trait/Ontology are not coloured, so they can be
   * distinguished, but they may obscure the signal provided by defined values.
   */
  visibleByOntology : false,
  visibleByTrait : false,

  /** if true, then user tab selection (Block / Trait / Ontology) changes the
   * settings qtlColourBy and visibleBy{Ontology,Trait}
   */
  tabSetsColourByVisible : true,

});
