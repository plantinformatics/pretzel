import { eq } from 'frontend/helpers/eq';
import { module, test } from 'qunit';

module('Unit | Helper | eq');

test('should be false if the two inputs are not equal', function(assert) {
  let result = eq([42, 41]);
  assert.notOk(result);
});

test('should be true if the two inputs are equal', function(assert) {
  let result = eq([42, 42]);
  assert.ok(result);
});
