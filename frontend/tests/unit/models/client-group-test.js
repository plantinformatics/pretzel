import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';

module('Unit | Model | client group', function(hooks) {
  setupTest(hooks);

  // Replace this with your real tests.
  test('it exists', function(assert) {
    let store = this.owner.lookup('service:store');
    let model = store.createRecord('client-group', {});
    assert.ok(model);
  });
});
