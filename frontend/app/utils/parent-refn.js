import EmberObject from '@ember/object';

/** link between parent and child components.
 */
export default EmberObject.extend({
  
  init() {
    console.log('init', this.get('sibings'));
    this._super(...arguments);

    this.siblings.addObject(this);
  },
  willDestroy() {
    console.log('willDestroy', this.get('sibings'));

    this.siblings.removeObject(this);
    this._super(...arguments);
  },


});
