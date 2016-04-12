import DS from 'ember-data';
import config from '../../config/environment';

export default DS.RESTAdapter.extend({
  coalesceFindRequests: true,
  namespace: 'api/v1',
  host: `${config.apiURL}`
});
