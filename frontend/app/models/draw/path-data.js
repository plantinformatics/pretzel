import { alias } from '@ember/object/computed';
import Model, { attr, belongsTo } from '@ember-data/model';

const dLog = console.debug;

export default Model.extend({

  feature0 : belongsTo('feature', {async: true, inverse: null}),
  feature1 : belongsTo('feature', {async: true, inverse: null}),

  /** block{0,1} are currently copies of data values, will become references to
   * store objects, as with feature{0,1}
  block0: DS.belongsTo('block', { inverse: null }),
  block1: DS.belongsTo('block', { inverse: null }),
   */
  blockId0 : alias('feature0.blockId.id'),
  blockId1 : alias('feature1.blockId.id'),


  /*--------------------------------------------------------------------------*/

  log() {
    dLog(this.get('feature0.name'), this.get('feature1.name'),
         this.get('blockId0'), this.get('blockId1'));
  }

});
