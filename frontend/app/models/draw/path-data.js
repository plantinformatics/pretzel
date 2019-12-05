import Ember from 'ember';
import DS from 'ember-data';
import attr from 'ember-data/attr';

const dLog = console.debug;

export default DS.Model.extend({

	feature0 : DS.belongsTo('feature', { inverse: null }),
  feature1 : DS.belongsTo('feature', { inverse: null }),

  /** block{0,1} are currently copies of data values, will become references to
   * store objects, as with feature{0,1}
  block0: DS.belongsTo('block', { inverse: null }),
  block1: DS.belongsTo('block', { inverse: null }),
   */
  blockId0 : Ember.computed.alias('feature0.blockId.id'),
  blockId1 : Ember.computed.alias('feature1.blockId.id'),


  /*--------------------------------------------------------------------------*/

  log() {
    dLog(this.get('feature0.name'), this.get('feature1.name'),
         this.get('blockId0'), this.get('blockId1'));
  }

});
