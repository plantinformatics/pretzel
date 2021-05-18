import Component from '@ember/component';

/** The heading line which is the first child a panel-container.
 *
 * Provides a solid rectangle, and a toggle button to enable / disable
 * display of the child components after the heading.
 * The rectangle colour is currently rgb(51, 122, 183) -
 * $panel-primary-border (ember-bootstrap/bootstrap/_panels.scss),
 * #337ab7 in app.scss, can abstract this, e.g. appPrimaryColour.
 *
 * @param panelContainer parent panel-container, used in template for
 * panelContainer.toggleShow action and panelContainer.showComponent flag
 */
export default Component.extend({
  tagName: 'div',
  // attributes
  // classes
  classNames: ['panel-heading']
  // actions
});
