import Service from '@ember/service';

export default class DataVcfGenotypeService extends Service {

  /** Arrays of sample names, per dataset. indexed by VCF datasetId
   */
  sampleNames = {};

}
