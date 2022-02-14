import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';

module('Integration | Helper | without-punctuation', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    this.set('inputValue', ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz{|}~');

    await render(hbs`{{without-punctuation inputValue}}`);

    assert.equal(this.element.textContent.trim(), '________________0123456789_______ABCDEFGHIJKLMNOPQRSTUVWXYZ_____abcdefghijklmnopqrstuvwxyz____');
  });
});
