import Component from '@glimmer/component';

import EmberObject, { computed, action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { alias } from '@ember/object/computed';

//------------------------------------------------------------------------------

const dLog = console.debug;

//------------------------------------------------------------------------------

/** This represents no filter selection made in the Haplotype pull-down, i.e. All.
 */
const noHaplotype = EmberObject.create({id : 'noHaplotype', name : 'All'});


//------------------------------------------------------------------------------

/** Parse the text result from API endpoint haplotype_samples
 * and display in a <select>, enabling the user to select a haplotype and
 * add its samples to the selected samples.
 * @param the manage-genotype
 * @param samples or @the.samples
 */
export default class PanelHaplotypesSamplesComponent extends Component {
  @service('query-params') queryParamsService;

  @alias('queryParamsService.urlOptions') urlOptions;

  //----------------------------------------------------------------------------

  constructor() {
    super(...arguments);

    if (window.PretzelFrontend) {
      window.PretzelFrontend.haplotypesSamples = this;
    }
  }

  //----------------------------------------------------------------------------


  /** 
   * @data haplotypeSamples text result from API
   */
  @computed('args.data', 'args.the.samples')
  get haplotypesSamples() {
    const fnName = 'haplotypesSamples';
    /** If there are no SNPs selected, data can be null.
     * genotype-samples only instantiates this component when
     * result.isResolved, but in this case there is no new request.  */
    if (! this.args.data) {
      dLog(fnName, '! @data');
      return [];
    }

    const
    haplotypes = this.args.data.trim().split('\n')
      .map(line => {
        const
        columns = line.split(' '),
        [haplotype, count, samplesText] = columns,
        /** first character is ',', so discard the first value
         * limit to 20 during development.
         */
        sampleNumbers = samplesText.split(',').slice(1, 20),
        /** sample column numbers in the API result are 1-indexed,
         * whereas .samples[] is 0-indexed.
         */
        samples = this.args.the.samples ?
          sampleNumbers.map(i => this.args.the.samples[i-1]) : sampleNumbers,
        /** form/select-multiple uses .id (unique id) and .name (display name). */
        name = haplotype + ' ' + count + ' ' + samples.join(','),
        hs = {haplotype, count, samples, id : haplotype, name};
        return hs;
      });
    return haplotypes;
  }

  //----------------------------------------------------------------------------

  /** defined if user has selected haplotypes, for samples to lookup. */
  @tracked
  haplotypesSelected = undefined;

  /**
   * @param selectedHaplotype  null or { id, name, ... } Ember Object
   *
   * based on manage-explorer.js : selectedCategoryChanged()
   */
  selectedHaplotypeChanged(selectedHaplotype) {
    const fnName = 'selectedHaplotypeChanged';

    const isMultiple = true;
    if (selectedHaplotype === noHaplotype) {
      this.haplotypesSelected = null;
    } else if (! isMultiple) {
      this.haplotypesSelected = selectedHaplotype;
    } else {
      const
      haplotypes = this.haplotypesSelected || (this.haplotypesSelected = []),
      /** or c === selectedHaplotype */
      present = haplotypes.find(c => c.id == selectedHaplotype.id);
      /** use .pushObject() (or .removeObject) so that () sees the
       * change to its dependency haplotypesSelected.length */
      if (present) {
        haplotypes.removeObject(present);
      } else {
        haplotypes.pushObject(selectedHaplotype);
      }
      const samples = selectedHaplotype.samples;
      this.args.the.selectSampleArray(samples, ! present);
    }
    dLog(fnName, selectedHaplotype, this.haplotypesSelected);
  }

  //----------------------------------------------------------------------------

}
