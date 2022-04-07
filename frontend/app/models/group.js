import Model, { attr, belongsTo, hasMany } from '@ember-data/model';
import { computed } from '@ember/object';

// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------


/*
export default class GroupModel extends Model {

  @attr('string') name;

}
*/


export default Model.extend({

  name : attr('string'),
  /** creator / owner / admin of the group */
  // @belongsTo('client') clientId;
  clientId : belongsTo('client'),
  /** members of the group */
  clients: hasMany('client', { async: false }),
  clientGroups: hasMany('client-group', { async: false }),

  // ---------------------------------------------------------------------------

  get isVisible() {
    let
    clientGroups = this.get('clientGroups'),
    visibleByCG = clientGroups?.findBy('isVisible'),
    visible = !! visibleByCG;
    if (clientGroups) {
      dLog('isVisible', visible, this.name, clientGroups.mapBy('id'), clientGroups.mapBy('isVisible'));
    }
    return visible;
  },

  // ---------------------------------------------------------------------------

});

