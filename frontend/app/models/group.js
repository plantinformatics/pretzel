import Model, { attr } from '@ember-data/model';

/*
export default class GroupModel extends Model {

  @attr('string') name;

}
*/


export default Model.extend({

  name : attr('string'),
  clientId : attr('string'),

});

