import Model, { attr, belongsTo, hasMany } from '@ember-data/model';

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

});

