import Model, { attr } from '@ember-data/model';

export default class ClientGroupModel extends Model {

  @attr('string') clientId;
  @attr('string') groupId;

}
