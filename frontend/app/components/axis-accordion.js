import Ember from 'ember';

/** axis-accordion could be absorbed into axis-2d,
 * but this separation of concerns seems useful : axis-2d connects external
 * concerns (i.e. stacks) to the inside of the axis space, whereas
 * axis-accordion is inward-facing : managing the sharing of horizontal space between its
 * children, within the axis space.
*/
export default Ember.Component.extend({
  classNames: ['axis-accordion-container']

});
