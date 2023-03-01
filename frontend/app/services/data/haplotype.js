import { computed } from '@ember/object';

import Service from '@ember/service';

//------------------------------------------------------------------------------

/*global d3 */


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
    const scale = d3.scaleOrdinal().range(d3.schemeCategory20);
    return scale;
  }


}
