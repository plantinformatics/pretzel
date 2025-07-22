import { module, test } from 'qunit';
import { setupTest } from 'pretzel-frontend/tests/helpers';

module('Unit | Route | account-settings', function (hooks) {
  setupTest(hooks);

  test('it exists', function (assert) {
    let route = this.owner.lookup('route:account-settings');
    assert.ok(route);
  });
});
