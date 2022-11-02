import Model, { attr } from '@ember-data/model';

export default class DrawStackModel extends Model {
  @attr('array') axes;
}
