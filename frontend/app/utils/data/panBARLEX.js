import { later } from '@ember/runloop';

import { isEqual } from 'lodash/lang';
// import { nowOrLater } from '../../../utils/ember-devel';

/** Before using these functions, init() is required, and is called by the
 * calling component (manage-explorer) */
import vcfGenotypeBrapi from '@plantinformatics/vcf-genotype-brapi';  // ipkPanbarlexServer
const {
  clusterIds, getChromosomes, getGene, geneToFeature
} = vcfGenotypeBrapi.ipkPanbarlexServer;
// } from '../../utils/ipk-panbarlex-server'; // devel

//------------------------------------------------------------------------------

const dLog = console.debug;

//------------------------------------------------------------------------------

/** Given the chromosome information from contig_length, create a Dataset and
 * Blocks, pushed into the store.
 *
 * Usage :
 *   getChromosomes(referenceAssemblyName).then(chrs => pushChromosomes( , chrs)
 * @param {object} this		object to store .dataset and .blocks
 * @param {object} transient	service('data/transient'),
 * @param {Array<object>} chrs	result from getChromosomes()
 * @return {object} datasetBlocks {dataset, blocks} handles of records pushed
 * into Ember Data store
 */
export function pushChromosomes(transient, chrs) {
  let result;

  const
  referenceAssemblyName = chrs[0].sampleId; // 'Morex',
  {
    const
    blockNames = chrs.mapBy('contigId'),
    scopesForNames = blockNames,
    features = [];

    {
      const
      parentName = 'RGT_PlanetV1', // parent displayName : Hordeum vulgare-RGT_PlanetV1-Genome', // 'Barley_MorexV3',
      namespace = 'Hordeum vulgare-RGT_PlanetV1';

      /** Based on panel/upload/blast-results-view.js : viewFeatures() */

      const
      /** append parentName to make transient datasets distinct by parent */
      datasetName = ('PanBARLEX_' + referenceAssemblyName /*+ parentName*/),
      dataset = transient.pushDatasetArgs(
        datasetName,
        parentName,
        namespace
      );

      let blocks = transient.blocksForSearch(
        datasetName,
        blockNames,
        scopesForNames,
        namespace
      );
      transient.datasetBlocksResolveProxies(dataset, blocks);

      /** Copy [start, end] from chrs[] to blocks[].range */
      blocks.forEach((b,i) =>
        b.range ||
          ((b.name == chrs[i].contigId) &&
           b.set('range', [1, chrs[i].length])));

      result = {dataset, blocks};
    }
  }
  return result;
}
/** Given the chromosome information from contig_length, add blocks to dataset,
 * pushed into the store.
 *
 * Usage :
 *   getChromosomes(referenceAssemblyName).then(chrs => pushChromosomesToDataset( , chrs)
 * @param {object} transient	service('data/transient'),
 * @param {object} dataset	store Dataset object to add Blocks to
 * @param {Array<object>} chrs	result from getChromosomes()
 * @return {object} datasetBlocks {dataset, blocks} handles of records pushed
 * into Ember Data store
 */
export function pushChromosomesToDataset(transient, dataset, chrs) {
  const
  blockNames = chrs.mapBy('contigId'),
  scopesForNames = blockNames,
  blocks = datasetAddBlocks(
    transient, dataset,
    blockNames,
    scopesForNames
  );
  /** The Dataset is not transient, but its Blocks and Features are, so tag
   * transient has the correct effect. */
  dataset.tags.push('transient');
  transient.datasetBlocksResolveProxies(dataset, blocks);

  /** Copy [start, end] from chrs[] to blocks[].range */
  blocks.forEach((b,i) =>
    b.range ||
      ((b.name == chrs[i].contigId) &&
       b.set('range', [1, chrs[i].length])));

  const result = {dataset, blocks};

  return result;
}
/** Add blocks named blockNames to dataset, push into dataset store
 *  blocks for the given datasetId and {name,scope,namespace}
 * @param blockNames, scopesForNames are parallel
 * @desc based on blocksForSearch()
 */
function datasetAddBlocks(transient, dataset, blockNames, scopesForNames) {
  const
  store = dataset.get('store'),
  datasetId = dataset.id,
  namespace = dataset.namespace,
  blocks = blockNames.map((name, i) => {
    const
    scope = scopesForNames[i],
    // referenceBlockSameServer() uses Block .namespace
    data = {_id : datasetId + '-' + name, scope, name, namespace, datasetId},
    block = transient.pushData(store, 'block', data);
    return block;
  });
  return blocks;
}


/** For the given Feature data, if its parent block is viewed, load into the
 * Ember Data store, and show it.
 * Currently called with 1 feature at a time, to provide a smooth / progressive
 * display update in the GUI, and smooth the load on the server.
 * @param {object} transient	service('data/transient'),
 * @param {object} datasetBlocks	object in which pushChromosomes() has returned .dataset and .blocks
 * @param {Array<object>} features	result from getGene() or  getGKnownGenes()
 * @return {object} stored Feature object, if features?.length, otherwise undefined.
 */
export function pushFeatures(transient, datasetBlocks, features) {
  const
  dataset = datasetBlocks.dataset,
  datasetName = dataset.id,
  blocks = datasetBlocks.blocks;

  if (features && features.length) {

    /** change features[].blockId to match blocks[], which has dataset.id prefixed to make them distinct.  */
    let featuresU = features.map((f) => { let {blockId, ...rest} = f; rest.blockId = dataset.id + '-' + blockId; return rest; });

    const featuresInView = featuresU.filter(f => blocks.findBy('id', f.blockId)?.isViewed);
    /** Param viewRow[] needs to cover featuresU[], which atm has length 0 or 1,   */
    const stored = transient.showFeatures(dataset, blocks, featuresInView, /*active*/true, /*viewRow*/[true]);

    return stored;
  }
}

/** draft for adding a single feature.  May not be required.
 * @param featureData similar to features[row]
 */
function addFeature(transient, featureData, row) {
  const
  feature = transient.pushFeature(featureData);
  later(
    () => transient.showFeature(feature, /*viewFeaturesFlag*/true));
}

//------------------------------------------------------------------------------

/** Get PanBARLEX Known Genes data, create a dataset and blocks (chromosomes)
 * and insert the feature data in the blocks.  View the blocks and the features.
 * @param {object} transient	service('data/transient')
 */
export function knownGenesDataset(transient, viewDataset) {
  const fnName = 'knownGenesDataset';
  getChromosomes('Morex').then(responses => {
    dLog('getChromosomes', responses);
    const datasetBlocks = pushChromosomes(transient, responses);

    const
    dataset = datasetBlocks.dataset,
    datasetName = dataset.id,
    blocks = datasetBlocks.blocks;
    viewDataset(datasetName, blocks);
    // pushFeatures() will showFeatures() for blocks which are viewed.
    later(() => showGenes(transient, datasetBlocks));

  });
}
/** Get (and show) the genes listed in clusterIds.
 * @param {object} transient	service('data/transient')
 * @param {object} datasetBlocks {dataset, blocks} handles of records pushed, returned by pushChromosomes()
 * @return promise yielding an array of cluster / gene details
 */
function showGenes(transient, datasetBlocks) {
  const
  fnName = 'showGenes',
  allP = Promise.all(getGenes(transient, datasetBlocks));
  allP.then(features => dLog(fnName, features.length));
}
/** Get (and show) the genes listed in clusterIds.
 * pushFeatures() will showFeatures() for blocks which are viewed.
 * @param {object} transient	service('data/transient')
 * @param {object} datasetBlocks {dataset, blocks} handles of records pushed, returned by pushChromosomes()
 * @return {Array<Promise>}	array of promises, parallel to clusterIds, each yielding the cluster / gene details
 */
function getGenes(transient, datasetBlocks) {
  const
  promises = clusterIds.map(clusterId =>
    getGene(clusterId).then(gene => {
      const feature = geneToFeature(gene);
      const f = pushFeatures(transient, datasetBlocks, [feature]);
      return f;
    }));

  return promises;
}


//------------------------------------------------------------------------------

/**
 * @param {object} dataset  undefined or dataset to add Blocks and Features to
 * @desc based on knownGenesDataset(), with the change that dataset is uploaded
 * and passed in here whereas knownGenesDataset() creates a transient dataset.
 */
export function knownGenesAddToDataset(transient, blocksService, viewDataset, dataset) {

  const
  fnName = 'knownGenesAddToDataset',
  PanBARLEXName = datasetNameToPanBARLEX(blocksService, dataset.get('id'));
  getChromosomes(PanBARLEXName).then(responses => {
    dLog('getChromosomes', responses);
    const
    chrs = responses;
    const datasetBlocks = pushChromosomesToDataset(
      transient, dataset, responses);

    // expect that : dataset === datasetBlocks.dataset,
    const
    datasetName = dataset.id,
    blocks = datasetBlocks.blocks;
    viewDataset(datasetName, blocks);

    // pushFeatures() will showFeatures() for blocks which are viewed.
    later(() => showGenes(transient, datasetBlocks), 2000);
  });

}

/** Map from Pretzel datasetId to PanBARLEXName.
 * @param {string} datasetId e.g. 'RGT_PlanetV1'
 * @return {string} corresponding meta.PanBARLEXName e.g. "RGT_Planet"
 */
function datasetNameToPanBARLEX(blocksService, datasetId) {
  const
  fnName = 'datasetNameToPanBARLEX',
  datasetsBlocks = blocksService.apiServerSelectedOrPrimary.datasetsBlocks,
  dataset = datasetsBlocks.findBy('id', datasetId),
  PanBARLEXName = dataset.get('_meta.PanBARLEXName');
  dLog(fnName, datasetId, PanBARLEXName);
  return PanBARLEXName;
}

//------------------------------------------------------------------------------

