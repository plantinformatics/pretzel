import { later } from '@ember/runloop';

import { isEqual } from 'lodash/lang';
// import { nowOrLater } from '../../../utils/ember-devel';

/** Before using these functions, init() is required, and is called by the
 * calling component (manage-explorer) */
import {
  clusterIds, getChromosomes, getGene, geneToFeature
} from '@plantinformatics/vcf-genotype-brapi';  // ipkPanbarlexServer
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
/** For the given Feature data, if its parent block is viewed, load into the
 * Ember Data store, and show it.
 * Currently called with 1 feature at a time, to provide a smooth / progressive
 * display update in the GUI, and smooth the load on the server.
 * @param {object} this		object in which pushChromosomes() has stored
 * .dataset and .blocks
 * @param {object} transient	service('data/transient'),
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
    () => transient.showFeature(feature, viewFeaturesFlag));
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
    later(() => showGenes());

    function showGenes() {
    const
    allP = Promise.all(clusterIds.map(clusterId =>
      getGene(clusterId).then(gene => {
        const feature = geneToFeature(gene);
        const f = pushFeatures(transient, datasetBlocks, [feature]);
        return f;
      })));
    allP.then(features => dLog(fnName, features.length));
    }

  });
}


//------------------------------------------------------------------------------

