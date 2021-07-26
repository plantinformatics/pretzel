import EmberObject, { computed } from '@ember/object';
import Service, { inject as service } from '@ember/service';
import { A } from '@ember/array';

const dLog = console.debug;

const trace = 1;

/** This can be a parameter, when additional groupings are added. */
const groupName = 'traits';

/** QTLs, which are Features, have an attribute values.Trait.

 * QTLs are displayed in the View panel grouped by Trait, with a
 * toggle on Trait to
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
        trait = EmberObject.create({name, visible : true, features : A()});
        group.pushObject(trait);
      }
      trait.features.addObject(feature);
    }
  },
  featureFilter(groupName = 'traits', feature) {
    let group = this.get(groupName);
  },

});
