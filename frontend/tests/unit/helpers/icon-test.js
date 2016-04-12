import { icon } from 'frontend/helpers/icon';
import { module, test } from 'qunit';

module('Unit | Helper | icon');

test('renders user icon when passed a user', function(assert) {
  let result = icon(["user"]);

  assert.ok(result);
  assert.equal(result.toString(), "<i class=' user icon'></i>");
});

test('renders user icon when passed a user', function(assert) {
  let result = icon(["user"], {circular: true});

  assert.ok(result);
  assert.equal(result.toString(), "<i class='circular user icon'></i>");
});


