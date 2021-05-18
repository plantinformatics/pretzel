import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';

module('Unit | Route | mapview/map', function(hooks) {
  setupTest(hooks);

  test('it exists', function(assert) {
    let route = this.owner.lookup('route:mapview/map');
    assert.ok(route);
  });
});
