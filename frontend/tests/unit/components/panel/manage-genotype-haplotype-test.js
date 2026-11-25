import { module, test } from 'qunit';
import EmberObject, { get, set } from '@ember/object';
import { run } from '@ember/runloop';
import PanelManageGenotypeComponent from 'pretzel-frontend/components/panel/manage-genotype';

const methods = PanelManageGenotypeComponent.prototype;

module('Unit | Component | panel/manage-genotype | missing haplotype calls', function() {
  test('missing policy separates cache reads, writes and throttled requests', async function(assert) {
    const settings = EmberObject.create({ filterSamplesByHaplotype: true, matchHet: false, allowMissing: false });
    const dataset = EmberObject.create({ id: 'dataset', genotypeId: 'dataset', _meta: {} });
    dataset.hasTag = () => false;
    const block = EmberObject.create({ id: 'block', name: '1A', datasetId: dataset });
    const features = [EmberObject.create({ value_0: 10 })];
    features[0][Symbol.for('matchRef')] = true;
    const pending = [];
    const context = {
      args: { userSettings: settings },
      sampleCache: EmberObject.create({ filteredByGenotype: {}, filteredByGenotypeCount: 0 }),
      selectedSNPsInBrushedDomain: () => features,
      selectedSNPsToKey: methods.selectedSNPsToKey,
      selectedSNPsToKeyWithSortAndMap: methods.selectedSNPsToKeyWithSortAndMap,
      vcfGenotypeSamplesDataset: methods.vcfGenotypeSamplesDataset,
      viewedVCFBlocks: [], receivedNamesCount: 0,
      auth: { genotypeSamples(blockArg, datasetId, scope, filter) {
        return new Promise(resolve => pending.push({ filter, resolve }));
      } },
      showError(name, error) { throw error; },
    };
    const strictKey = methods.selectedSNPsToKeyWithSortAndMap.call(context, features);
    const strict = run(() => methods.vcfGenotypeSamplesBlock.call(context, block));
    set(settings, 'allowMissing', true);
    const permissiveKey = methods.selectedSNPsToKeyWithSortAndMap.call(context, features);
    const permissive = run(() => methods.vcfGenotypeSamplesBlock.call(context, block));
    assert.notEqual(strictKey, permissiveKey);
    assert.equal(pending.length, 2, 'toggling bypasses the previous throttled request');
    assert.false(pending[0].filter.allowMissing);
    assert.true(pending[1].filter.allowMissing);

    // Complete the old request last: its response must not replace the active policy.
    pending[1].resolve('exact\nmissing');
    await permissive;
    pending[0].resolve('exact');
    await strict;
    assert.deepEqual(methods.blockFilteredSamplesGet.call(context, block), ['exact', 'missing']);
    set(settings, 'allowMissing', false);
    assert.deepEqual(methods.blockFilteredSamplesGet.call(context, block), ['exact']);
  });

  test('the block filter invalidates when the missing policy changes', function(assert) {
    const settings = EmberObject.create({ allowMissing: false });
    const block = EmberObject.create({
      controls: { userSettings: { genotype: settings } },
    });
    const context = {
      genotypeSamplesFilteredByHaplotypes() {
        return settings.allowMissing ? ['exact', 'missing'] : ['exact'];
      },
    };
    methods.blockSetup.call(context, block);
    assert.deepEqual(get(block, 'genotypeSamplesFilteredByHaplotypes'), ['exact']);
    set(settings, 'allowMissing', true);
    assert.deepEqual(get(block, 'genotypeSamplesFilteredByHaplotypes'), ['exact', 'missing']);
  });
});
