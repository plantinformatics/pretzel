import { computed } from '@ember/object';

import Service from '@ember/service';

//------------------------------------------------------------------------------

/*global d3 */


/** Functionality which is application-wide, such as common colours,
 * related to LD Blocks / tSNP sets / Haplotypes.
 *
 * A note on terminology : this functionality is related to Haplotypes, but
 * distinct, the term Haplotype is used in function and variable names because
 * this work is part of the vision for Haplotype functionality, and some of it
 * may be common, but the implementation so far is using LD Blocks via tagged
 * SNP sets - INFO/tSNP in the vcf.
 * The user-facing terminology in the GUI has been changed from Haplotype to LD
 * Block.  Function and variable names are not changed; they may
 * in the long term be used as part of Haplotype functionality.
 */
export default class DataHaplotypeService extends Service {

  /** Map from haplotype / tSNP to colour; each Tagged SNP set is allocated a
   * distinct colour (the palette schemeCategory20 is used, so colours cycle
   * after 20 sets).
   * The values passed to this scale are string representation of tSNP numbers,
   * e.g. "7924"
   *
   * Moved here from components/matrix-view.js to enable manage-genotype.js to
   * use the same colour scheme.   Related : ./ontology.js : ontology_colour_scale
   *
   * Until 14056044, haplotype.column was passed to this scale; now tSNP is passed in.
   * matrix-view owns mapping from tSNP to column.
   * This service data/haplotype owns mapping from tSNP to colour.
   * Currently a single scale is used for tSNPs which could be from different
   * Blocks / Datasets; that is useful for small numbers of tSNP sets, but later
   * it may be desirable to allocate a scale to each Block / Dataset.
   */
  @computed()
  get haplotypeColourScale () { 
    const scale = d3.scaleOrdinal().range(d3.schemeCategory10/*20*/);
    return scale;
  }

  /** 
   * The values passed to this scale are string representation of Variant Interval,
   * e.g. "1159971-1161884"
   */
  @computed()
  get variantIntervalColourScale () { 
    const scale = d3.scaleOrdinal().range(d3.schemeCategory10/*20*/);
    return scale;
  }

}
