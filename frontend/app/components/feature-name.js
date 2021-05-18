import Component from '@ember/component';

export default Component.extend({
  tagName: 'span',
  classNames: ['featureName', 'btn',  'btn-link'],

  didInsertElement() {
    this._super(...arguments);
    console.log("components/feature-name didInsertElement()", this);
  }
});
