import { find, render } from '@ember/test-helpers';
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | draw map', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    // Set any properties with this.set('myProperty', 'value');
    // Handle any actions with this.on('myAction', function(val) { ... });

    await render(hbs`{{draw-map}}`);

    assert.dom('*').hasText('');

    // Template block usage:
    await render(hbs`
      {{#draw-map}}
        template block text
      {{/draw-map}}
    `);

    assert.dom('*').hasText('template block text');
  });
});
