import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';

module('Integration | Helper | safeStyle', function(hooks) {
  setupRenderingTest(hooks);

  // TODO: Replace this with your real tests.
  test('it renders', async function(assert) {
    this.set('inputValue', '#1f77b4');

    await render(hbs`{{safe-style inputValue}}`);

    assert.equal(this.element.textContent.trim(), 'background-color: #1f77b4');
  });
});
