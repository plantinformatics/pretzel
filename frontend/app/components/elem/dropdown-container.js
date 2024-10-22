import { computed } from '@ember/object';
import Component from '@ember/component';

export default Component.extend({
  tagName: 'span',
  // attributes
  click: function() {
    /** 3828f884 created this component with this function :
     *   click: function() { this.sendAction('onClick'); },
     * here and in siblings button-refresh and dropdown-row, so it may
     * have been an unused leftover in this case.
     * 48e5ec2d added {{action this.click }} in .hbs to <button .dropdown-toggle>
     * which calls this function, but it's not clear that it has a role.
     */
    console.log('dropdown-container', 'click');
  },
  // classes
  // classNames: ['btn'],
  classNameBindings: ['pullRight'],
  pullRight: computed('right', function() {
    let prop = this.get('right')
    if (prop === true) {
      return 'pull-right'
    } else {
      return ''
    }
  }),
  menuRight: computed('right', function() {
    let prop = this.get('right')
    if (prop === true) {
      return 'dropdown-menu dropdown-menu-right'
    } else {
      return 'dropdown-menu'
    }
  })
  // actions
});
