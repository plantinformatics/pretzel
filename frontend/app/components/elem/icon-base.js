import { computed } from '@ember/object';
import Component from '@ember/component';

/** Use .name to add to the element's classes
 */
export default Component.extend({
  tagName: 'span',
  // attributes
  // classes
  classNameBindings: ['iconClass'],
  /**
   * @return undefined if name is undefined.
   */
  iconClass: computed('name', function() {
    let name = this.get('name')
    return name && 'glyphicon glyphicon-' + name;
  }),
  // actions
});
