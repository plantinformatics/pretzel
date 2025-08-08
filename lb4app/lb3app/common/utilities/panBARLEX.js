
//------------------------------------------------------------------------------

//import vcfGenotypeBrapi from '@plantinformatics/vcf-genotype-brapi';
//const /*import */{
//  getKnownGenes,
//} = vcfGenotypeBrapi.ipkPanbarlex; /*from 'vcf-genotype-brapi'; */
// const { getKnownGenes } = require('./ipk-panbarlex');
// import { getKnownGenes } from './ipk-panbarlex.js';
//'@plantinformatics/vcf-genotype-brapi');

let getKnownGenes;
import('@plantinformatics/vcf-genotype-brapi/dist/vcf-genotype-brapi-node.mjs').then(vcfGenotypeBrapi => {
  const ipkPanbarlexServer = vcfGenotypeBrapi.default.ipkPanbarlexServer;
  console.log('vcfGenotypeBrapi', vcfGenotypeBrapi, 'ipkPanbarlexServer', ipkPanbarlexServer);
  getKnownGenes = ipkPanbarlexServer.getKnownGenes;
});

//------------------------------------------------------------------------------

/** Base of web API endpoint URLs of IPK PanBARLEX
 */
const baseUrl = 'https://panbarlex.ipk-gatersleben.de';

//------------------------------------------------------------------------------

/** Get Known Genes from IPK PanBARLEX, and collate in a Pretzel dataset object
 * for upload.
 *
 * @param {string}  referenceAssemblyName	will be used in ID Liftover
 * @return {Promise<Object>}
 */
export function panBARLEXLoadKnownGenes(referenceAssemblyName) {
  const
  fnName = 'panBARLEXLoadKnownGenes',
  promise = 
    getKnownGenes().then(responses => {
      console.log('getKnownGenes', responses?.length);
      const
      dataset = genesToDataset(responses);
      return dataset;
    });

  return promise;
}

//------------------------------------------------------------------------------

/** Template for constructing Pretzel dataset object for upload.  */
const
datasetAttributes = {
  tags : [], // 'autoLoad'
  type : 'linear',
  parent : 'RGT_PlanetV1', // parent displayName : Hordeum vulgare-RGT_PlanetV1-Genome', // 'Barley_MorexV3',
  namespace : 'Hordeum vulgare-RGT_PlanetV1',
  public : true,
  readOnly : true,
  species : 'Hordeum vulgare',
  meta : {
    type : 'QTL', // 'Alignment',
    Crop : 'Barley',
    'Data source' : 'IPK PanBARLEX',
  }
};


/** Convert the /sequence_clusters/ responses to a dataset object containing
 * blocks[] which contain features[],  which can be loaded into Pretzel.
 *
 * Related :
 *   spreadsheet-read.js : spreadsheetDataToJsObj(), sheetToDataset(),
 *     blocksObjToArray(), featureAttributes()
 *   gff_read.js : gffDataToJsObj(), startDataset(), featureParsed(),
 *     newBlock(), addFeature(),
 * @param {Array<Object>} responses gene cluster data
 * @return {Object} Pretzel dataset/blocks/features object, for upload.
 */
function genesToDataset(responses) {
  const
  fnName = 'genesToDataset',
  responseToFeature = (d, r) => {
    const
    /** Plan to use dataDescription.referenceAssemblyName in place of default 'MOREX' */
    m = r.clusterMembers.find(cm => cm.sampleId == 'MOREX'),
    /** example data :
      {
        featureId: "HORVU.MOREX.PROJ.6HG00536260.1",
        sampleId: "Morex",
        seqid: "chr6H",
        start: 463923399,
        end: 463927173,
        contigLength: 561794515
      }
    */
    feature = m.genes[0].feature;
      const
      blockName = feature.seqid,
      block = d.blocks[blockName] ||
        (d.blocks[blockName] = {
          name : blockName, scope : blockName, features : [],
          range : [1, feature.contigLength]}),
      descriptions = r.descriptions,
      /** r.clusterId is e.g. 'BarleyCDS90_26655' */
      URL = baseUrl + '/#seqcluster/' + r.clusterId,
      values = { name2 : feature.featureId, descriptions, URL},
      f = {name : r.clusterId, value : [feature.start, feature.end], values};
      block.features.push(f);

      return d;
  },
  dataset = 
    responses.reduce(responseToFeature, {...datasetAttributes, blocks : {}});

  /** Convert dataset.blocks from object to array.
   * Using an object enables simple and quick lookup of whether blockName is
   * already in d.blocks[] above.
   */
  const blocksArray = Object.values(dataset.blocks).sort((a, b) => (a == b ? 0 : a < b ? -1 : +1));
  dataset.blocks = blocksArray;
  console.log(fnName, dataset);
  return dataset;
}

/* global require */
/*
const util = require('util');
function addDataset(models, dataset) {
  const
  gffUploadDataP = util.promisify(models.Dataset.gffUploadData),
  promis = this.gffUploadDataP(dataObj, datasetId, replaceDataset, options, models);
}
*/

//------------------------------------------------------------------------------
