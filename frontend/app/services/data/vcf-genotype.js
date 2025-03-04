import Service from '@ember/service';

export default class DataVcfGenotypeService extends Service {

  //----------------------------------------------------------------------------

  /** Arrays of sample names, per dataset. indexed by VCF datasetId
   */
  sampleNames = {};

  //----------------------------------------------------------------------------

  /** Arrays of sample names, per dataset. indexed by VCF blockId
   * This caches the result of vcfGenotypeSamplesDataset() when filterByHaplotype.
   */
  filteredByGenotype = {};
  filteredByGenotypeCount = 0;

  //----------------------------------------------------------------------------

  /** Count of dataset.enableFeatureFilters true/false values.
   * Used as a dependency, so the change of value matters rather than the absolute value.
   * Related : enableFeatureFiltersSymbol
   */
  datasetEnableFeatureFiltersCount = 0;

  //----------------------------------------------------------------------------

}
