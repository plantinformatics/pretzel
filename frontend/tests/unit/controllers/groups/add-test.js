import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';

module('Unit | Controller | groups/add', function(hooks) {
  setupTest(hooks);

  // TODO: Replace this with your real tests.
  test('it exists', function(assert) {
    let controller = this.owner.lookup('controller:groups/add');
    assert.ok(controller);
  });
});
