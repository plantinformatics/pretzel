import { find, render } from '@ember/test-helpers';
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | selected markers', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    // Set any properties with this.set('myProperty', 'value');
    // Handle any actions with this.on('myAction', function(val) { ... });

    await render(hbs`{{selected-markers}}`);

    assert.dom('*').hasText('');

    // Template block usage:
    await render(hbs`
      {{#selected-markers}}
        template block text
      {{/selected-markers}}
    `);

    assert.dom('*').hasText('template block text');
  });
});
