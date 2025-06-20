import Component from '@glimmer/component';

import { computed } from '@ember/object';
import { inject as service } from '@ember/service';


import { contentOf } from '../../utils/common/promises';

const dLog = console.debug;

//------------------------------------------------------------------------------

/** A view of models/block which supports Genotype Table (manage-genotype)
 * functionality.
 */
export default class PanelBlockGtViewComponent extends Component {
  @service() auth;

  //----------------------------------------------------------------------------

  constructor() {
    const fnName = 'constructor';
    super(...arguments);

    dLog(fnName, this.args.block);
    this.args.block[Symbol.for('block-gt-view')] = this;
  }

  //----------------------------------------------------------------------------


  /** Given 1 or more selected SNPs,
   * - collate the haplotype values of all samples at those SNPs,
   * - count the unique haplotype values, and for each unique haplotype value,
   * - - collate a list of samples which have that haplotype value.
   *
   * Here haplotype value means the genotype value of a sample at the selected SNPs.
   *
   * These are now handled :
   *
   * - multiple blocks (chromosomes) within a dataset
   *
   * - blocks of multiple datasets on the same axis / chromosome
   * haplotypes-samples has different data for each dataset.
   *
   * @return promise yielding the text returned by the API
   * or throw if these are not defined : vcfBlock.scope && vcfBlock.datasetId.genotypeId &&
   * this.selectedSNPsInBrushedDomain(vcfBlock)
   */

  /** When the user changes selected SNPs, request unique genotypePatterns and their samples.
   * Dependency is copied from snpsInBrushedDomain().
   * @return promise yielding {text } of the API result
   * or throwing null if e.g. there are no SNPs selected.
   */
  @computed('block.brushedDomain', 'args.mg.featureFiltersCount')
  get genotypePatternsSamples() {
    const
    fnName = 'genotypePatternsSamples',
    vcfBlock = this.args.block,
    mg = this.args.mg,
    /** As in vcfGenotypeSamplesDataset() */
    vcfDataset = contentOf(vcfBlock?.get('datasetId')),
    vcfDatasetId = vcfBlock?.get('datasetId.id'),
    vcfDatasetIdAPI = vcfBlock?.get('datasetId.genotypeId'),
    /** Same comment as in .lookupScope */
    scope = vcfBlock.get('name'),

    /** See comment in vcfGenotypeSamplesDataset() */
    positions = mg.selectedSNPsInBrushedDomain(vcfBlock)
      .sortBy('value_0')
      .mapBy('value_0');

    dLog(fnName, positions, vcfBlock.brushName, 'HaplotypesSamples');

    let textP;
    if (scope && vcfDatasetIdAPI && positions.length)   {

      mg.lookupMessage = null;

      textP = this.auth.genotypeHaplotypesSamples(
        vcfBlock, vcfDatasetIdAPI, scope, positions,
        {} )
        .then(text => {
          return text?.text;
        })
        // .catch(() => null);
        .catch(mg.showError.bind(mg, fnName));
    } else {
      textP = Promise.reject();
    }
    return textP;
  }


  //----------------------------------------------------------------------------

}
