import Model, { attr, belongsTo } from '@ember-data/model';

export default class ClientGroupModel extends Model {

  @belongsTo('client', { async: true, inverse : null/*'clientGroup'*/ }) clientId;
  @belongsTo('group', { async: true, inverse : null/*'clientGroups'*/ }) groupId;

  @attr('boolean') isVisible;

}
