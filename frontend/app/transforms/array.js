import { isArray, A } from '@ember/array';
import Transform from '@ember-data/serializer/transform';

export default Transform.extend({
	deserialize: function(serialized) {
		if (isArray(serialized)) {
			return A(serialized);
		} else {
			return A();
		}
	},

	serialize: function(deserialized) {
		if (isArray(deserialized)) {
			return A(deserialized);
		} else {
			return A();
		}
	}
});