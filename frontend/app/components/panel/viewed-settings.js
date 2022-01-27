import { inject as service } from '@ember/service';
import Component from '@ember/component';

const dLog = console.debug;

/**
 * args :
 * @param changed signal to parent component when user has changed settings.
 * action call signature is : changed(settings, changedFieldName) where settings contains :
 *  {
 *    qtlColourBy : string : 'Ontology', 'Trait', 'Block',
 *    ontologyClick : string : 'Level', ''Hierarchy'
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

  /** Colour QTL diamonds & <rect>s by one of : Ontology, Trait, Block. */
  qtlColourBy : 'Block',
  qtlColourByChanged(value) {
    dLog('qtlColourByChanged', value);
    this.changed(this, 'qtlColourBy');
  },

  /** Click on Ontology colours either the hierarchy below the clicked node, or
   * nodes at the same level as the clicked node. */
  ontologyClick : 'Level',
  ontologyClickChanged(value) {
    dLog('ontologyClickChanged', value);
    this.changed(this, 'ontologyClick');
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


});
