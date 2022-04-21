import Model, { attr, belongsTo } from '@ember-data/model';

export default class ClientGroupModel extends Model {

  @belongsTo('client') clientId;
  @belongsTo('group') groupId;

  @attr('boolean') isVisible;

}
