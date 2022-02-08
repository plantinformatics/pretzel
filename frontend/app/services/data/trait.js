import EmberObject, { computed } from '@ember/object';
import Service, { inject as service } from '@ember/service';
import { A } from '@ember/array';

import {
  traitColour
} from '../../utils/draw/axis';


/*----------------------------------------------------------------------------*/

const dLog = console.debug;

const trace = 1;

/** This can be a parameter, when additional groupings are added. */
const groupName = 'traits';

/*----------------------------------------------------------------------------*/

/**
 * @param name
 */
const Trait = EmberObject.extend({
  visible : false,
  init() {
    this._super(...arguments);
    this.set('features',  A());
  },

  get colour() {
    const colour = traitColour(this.name);
    return colour;
  }

});

/*----------------------------------------------------------------------------*/


/** QTLs, which are Features, have an attribute values.Trait.

 * QTLs are displayed in the View panel grouped by Trait, with a
 * toggle on Trait to enable visibility of QTLs of that trait.
 *
 * This can be seen as a grouping of Features, and there may be other,
 * similar groupings in addition to Trait.
 */
export default Service.extend({
  block : service('data/block'),
  controls : service(),

  /** array of {name, visible, features} */
  traits : A(),

  /** @return this.traits, filtered to the traits of currently-viewed blocks
   */
  traitsInView : computed('traits.[]', 'block.viewed.@each.traitSet', function () {
    /** another approach would be :
     *    this.traits.filter((t) => t.features.any((f) => f.blockId.isViewed))
     * Block.traitSet is constant, whereas trait[*].features[*] is constantly
     * changing, and larger-scale (although number of QTLs is probably not large).
     */
    let 
    traitSets = this.get('block.viewed').reduce((ts, b) => {
      let traitSet = b.get('traitSet');
      if (traitSet) { ts.push(traitSet); }
      return ts;
    }, []);
    let union = setsUnion(traitSets),
        traits = union && this.traits.filter((t) => union.has(t.name));
    dLog('traitsInView', traits);
    return traits;
  }),

  traitAdd(name) {
    let
    group = this.get(groupName),
    trait = Trait.create({name});
    group.pushObject(trait);
    return trait;
  },
  //groupAddFeature
  traitAddQtl(feature) {
    let
    name = feature.get('values.Trait');
    if (name) {
      let
      group = this.get(groupName),
      trait = group.findBy('name', name);
      if (! trait) {
        trait = this.traitAdd(name);
      }
      trait.features.addObject(feature);
    }
  },
  /** Set visibility of the given trait.
   *
   * If traitName is not in .trait[], add it (this is consistent with
   * setOntologyIsVisible(), which adds new ids to ontologyIsVisible[]).
   * In the only use of this function, adding new traitName is desirable.
   *
   * @param traitName
   * @param visible
   */
  traitVisible(traitName, visible) {
    const
    fnName = 'traitVisible',
    group = this.get(groupName);
    let
    trait = group.findBy('name', traitName);
    if (! trait) {
      dLog(fnName, traitName, 'not found, adding');
      trait = this.traitAdd(traitName);
    }
    trait.set('visible', visible);
  },
  /** If the feature has values.Trait (i.e. is a QTL), then return trait.visible, otherwise true.
   * Features which are not QTLs, are not filtered out.
   */
  featureFilter(groupName = 'traits', feature) {
    const
    fnName = 'featureFilter',
    group = this.get(groupName),
    traitName = feature.get('values.Trait'),
    visibleByTrait = this.get('controls.viewed.visibleByTrait'),
    trait = traitName && group && group.findBy('name', traitName),
    ok = ! visibleByTrait || (trait && trait.get('visible'));
    if (trace > 2) {
      dLog(fnName, traitName, ok);
    }
    return ok;
  },

});

/*----------------------------------------------------------------------------*/


/** combine an array of Set()
 * @return undefined if sets is []
 */
function setsUnion(sets) {
  let union;
  if (sets.length) {
    union = new Set(sets.shift());
    union = sets.reduce((u, ts) => {
      for (let trait of ts) {
        u.add(trait);
      }
      return u;
    }, union);
  }
  return union;
}

/*----------------------------------------------------------------------------*/
