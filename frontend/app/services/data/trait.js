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
  visible : true,
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
  /** array of {name, visible, features} */
  traits : A(),

  //groupAddFeature
  traitAddQtl(feature) {
    let
    name = feature.get('values.Trait');
    if (name) {
      let
      group = this.get(groupName),
      trait = group.findBy('name', name);
      if (! trait) {
        trait = Trait.create({name});
        group.pushObject(trait);
      }
      trait.features.addObject(feature);
    }
  },
  /** Set visibility of the given trait.
   * @param traitName
   * @param visible
   */
  traitVisible(traitName, visible) {
    const
    fnName = 'traitVisible',
    group = this.get(groupName),
    trait = group.findBy('name', traitName);
    if (! trait) {
      dLog(fnName, traitName, 'not found');
    } else {
      trait.set('visible', visible);
    }
  },
  /** If the feature has values.Trait (i.e. is a QTL), then return trait.visible, otherwise true.
   * Features which are not QTLs, are not filtered out.
   */
  featureFilter(groupName = 'traits', feature) {
    const
    fnName = 'traitVisible',
    group = this.get(groupName),
    traitName = feature.get('values.Trait'),
    trait = traitName && group && group.findBy('name', traitName),
    ok = trait ? trait.get('visible') : true;
    dLog(fnName, traitName, ok);
    return ok;
  },

});
