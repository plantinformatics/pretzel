import Model, { attr, belongsTo } from '@ember-data/model';

export default class ClientGroupModel extends Model {

  @belongsTo('client', { async: true, inverse : 'clientGroups' }) clientId;
  @belongsTo('group', { async: true, inverse : 'clientGroups' }) groupId;

  @attr('boolean') isVisible;

}
