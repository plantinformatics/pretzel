import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';

module('Unit | Route | mapview/new', function(hooks) {
  setupTest(hooks);

  test('it exists', function(assert) {
    let route = this.owner.lookup('route:mapview/new');
    assert.ok(route);
  });
});
