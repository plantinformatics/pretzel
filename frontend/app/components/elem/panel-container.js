import { computed } from '@ember/object';
import Component from '@ember/component';

const dLog = console.debug;

/** Used to group elements in the left and right side panels.
 * Owns the flag and action which enables display of the child
 * components after the heading.
 * The first child is expected to be panel-heading, which provides a
 * toggle button for showComponent / toggleShow.
 *
 * @param showComponent optional, default true : if given, provides
 * the initial value of showComponent.  If true, the child elements
 * and components are displayed.
 */
export default Component.extend({
  // attributes
  // classes
  classNameBindings: ['panelClass'],
  panelClass: computed('state', function() {
    return 'panel panel-' + this.state
  }),
  showComponent : true,
  /** later can make this @action instead of passing panelContainer as action param. */
  // @action
  toggleShow(panelContainer) {
    // this is currently panel-heading
    dLog('toggleShow', panelContainer.showComponent);
    panelContainer.toggleProperty('showComponent');
  }
  // actions
});
