/*import DS from 'ember-data';
import PartialModelRESTSerializer from 'ember-data-partial-model/mixins/rest-serializer';
const { RESTSerializer } = DS;

export default RESTSerializer.extend(PartialModelRESTSerializer);*/

import DS from 'ember-data';
import PartialModelRESTSerializer from 'ember-data-partial-model/mixins/rest-serializer';

export default DS.RESTSerializer.extend(PartialModelRESTSerializer, {
  //primaryKey: '_id'
});
