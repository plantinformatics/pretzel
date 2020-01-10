import Ember from 'ember';

import Helper from "@ember/component/helper";

/** Determine a class name for the given entry (e.g. a block).
 * Currently this is based on the entry.name.
 * The class can be used to direct colouring and layout,
 * e.g. give a distinct background colour for chromosome numbers which are odd,
 * to provided an alternate bands pattern to enable finding chromosomes more
 * easily.
 */
export default Helper.extend({

  store: Ember.inject.service('store'),

  compute(params) {
    let
      entry = params[0],
    name = entry.get('name'),
    m = name.match(/\d/),
    chrNum = m && m.length && Number(m[0]),
    isOdd = chrNum % 2,
    className = 'entryClass' + isOdd;
    // console.log('nameClass', name, chrNum, isOdd, className);
    return className;
  }
});



/*----------------------------------------------------------------------------*/
