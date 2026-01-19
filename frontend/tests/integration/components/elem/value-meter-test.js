import { module, test } from 'qunit';
import { setupRenderingTest } from 'pretzel-frontend/tests/helpers';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';

module('Integration | Component | elem/value-meter', function (hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function (assert) {
    // Set any properties with this.set('myProperty', 'value');
    // Handle any actions with this.set('myAction', function(val) { ... });

    await render(hbs`<Elem::ValueMeter />`);

    assert.dom(this.element).hasText('');

    // Template block usage:
    await render(hbs`
      <Elem::ValueMeter>
        template block text
      </Elem::ValueMeter>
    `);

    assert.dom(this.element).hasText('template block text');
  });
});
