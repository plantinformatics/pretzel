import { computed } from '@ember/object';
import Model, { attr, belongsTo, hasMany } from '@ember-data/model';
//import Fragment from 'model-fragments/fragment';
import { inject as service } from '@ember/service';


import { traitColour } from '../utils/draw/axis';

/* global d3 */

//------------------------------------------------------------------------------

const dLog = console.debug;


export default Model.extend({
  ontology : service('data/ontology'),
  haplotypeService : service('data/haplotype'),
  controls : service(),

  //----------------------------------------------------------------------------

  blockId: belongsTo('block'),
  _name: attr('string'),
  /* currently have a mix of .range and .value in pretzel-data [develop];
   * handle both for now;  chrData() also handles either.  */
  value: attr(),
  range: attr(),
  values: attr(),
  parentId: belongsTo('feature', {inverse: 'features'}),
  features: hasMany('feature', {inverse: 'parentId'}),

  /*--------------------------------------------------------------------------*/

  name : computed('_name', 'isAnon', function () {
    let name = this.get('_name') ||
        (this.get('isAnon') && (this.get('blockId.name') + ':' + this.get('value.0')));
    return name;
  }),

  get location() {
    return this.get('value.0') ?? this.get('value_0');
  },
  set location(v) {
    if (this.location !== v) {
      dLog('location set', v);
      this.set('value.0', v);
      this.get('value_0', v);
    }
  },

  isAnon : computed('blockId.datasetId.tags', function () {
    let block = this.get('blockId.content') || this.get('blockId'),
        anon = block.hasTag('AnonFeatures');
    return anon;
  }),

  /*--------------------------------------------------------------------------*/

  /** @return a positive interval equal in range to .value[]
   * @desc
   * feature can have a direction, i.e. (value[0] > value[1])
   * For domain calculation, the ordered value is required.
   */
  valueOrdered : computed('value', function () {
    let value = this.get('value');
    if (value[0] > value[1]) {
      value = [value[1], value[0]];
    }
    return value;
  }),

  /*--------------------------------------------------------------------------*/

  get traitColour() {
    let traitName = this.get('values.Trait'),
        colour = traitColour(traitName);
    return colour;
  },

  get ontologyColour() {
  // return ontology_colour_scale(ontologyId);
  let ontologyId = this.get('values.Ontology'),
      colour = ontologyId ? this.get('ontology').qtlColour(ontologyId) :
      this.get('ontologyColourDefault');
  return colour;
  },

  /** many QTLs don't have .Ontology yet (so colour is undefined - black) and
   * they are obscuring those that do, so try making the black translucent.
   */
  get ontologyColourDefault() {
    /** 4-bit alpha channel - single hex digit. */
    let alpha = this.get('controls.view.qtlUncolouredOpacity'),
        colour = "#000" + Number(alpha).toString(16);
    return colour;
  },

  //----------------------------------------------------------------------------

  /** Map values.tSNP (LD Block / Haplotype / tagged SNP set) to per-set colour.
   *
   * It seems likely that a concept of Haplotype separate from tSNP will be
   * added, so the naming may change; currently the name tSNP is used where it
   * relates directly to the Feature values.tSNP, and the term Haplotype is used
   * for higher level functionality related to selection / filtering / colouring
   * by Haplotype, which is concerned with the role of Haplotype rather than how
   * it is implemented (tSNP).
   * tSNP values identifies LD Blocks.
   *
   * @return undefined if values.tSNP is undefined
   */
  get haplotypeColour() {
    const
    tSNP = this.get('values.tSNP'),
    colour = tSNP && ((tSNP === '.') ? undefined : this.haplotypeService.haplotypeColourScale(tSNP));
    /** when tSNP === undefined or '.', fall back to blockTrackColourI in
     * axis-tracks.js : appendRect() : featureColour()
     */
    return colour;
  },
  
  //----------------------------------------------------------------------------


  colour(qtlColourBy) {
    let colour;
    switch (qtlColourBy) {
    case 'Trait' : colour = this.get('traitColour');  break;
    case 'Ontology' : colour = this.get('ontologyColour');  break;
    case 'Haplotype' : colour = this.get('haplotypeColour');  break;  // LD Block / tSNP
    default : dLog('colour', qtlColourBy); break;
    }
    return colour;
  },




  //----------------------------------------------------------------------------


});
