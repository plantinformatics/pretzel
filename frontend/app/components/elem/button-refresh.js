import Component from '@ember/component';

/**
 * @param classNames  optional;  default ['pull-right']
 */
export default Component.extend({
  tagName: 'span',
  // attributes
  click: function() {
    this.sendAction('onClick');
  },
  // classes
  classNames: undefined,
  // actions

  // ---------------------------------------------------------------------------

  init() {
    this._super(...arguments);

    if (! this.classNames) {
      this.set('classNames', ['pull-right']);
    }
  },
});
