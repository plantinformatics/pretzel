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


  /** Parse the data into an array of {haplotype, count, samplesText}.
   * @data haplotypeSamples text result from API
   */
  @computed('args.data', 'args.the.samples', 'args.userSettings.sortByHaplotypeValue')
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
    sortByHaplotypeValue = this.args.userSettings.sortByHaplotypeValue,
    keyName = sortByHaplotypeValue ? 'haplotype' : 'count',
    haplotypes = this.args.data.trim().split('\n')
      .map(line => {
        const
        columns = line.split(' '),
        [haplotype, count, samplesText] = columns,
        hs = {haplotype, count: +count, samplesText};
        return hs;
      })
      .sortBy(keyName)
      .reverse();
    return haplotypes;
  }
  /** Convert the result of haplotypesSamples() into text for display in the <select>
   */
  @computed('haplotypesSamples', 'args.userSettings.showHaplotypesSamples')
  get haplotypesSamplesText() {
    const
    fnName = 'haplotypesSamplesText',
    mg = this.args.the,
    allSamplesText = mg.sampleCache.sampleNames[mg.lookupDatasetId],
    allSamples = allSamplesText?.split('\n'),
    haplotypesSamples = this.haplotypesSamples,
    haplotypes = haplotypesSamples.map(({haplotype, count, samplesText}) => {
      const
        /** It is possible to display hundreds of sample names in a single line,
         * but it doesn't seem useful. */
        displayLimit = 100,
        /** first character is ',', so discard the first value.
         * Limit the number of sample names displayed in each row.
         */
        sampleNumbers = samplesText.split(',').slice(1, displayLimit),
        /** sample column numbers in the API result are 1-indexed,
         * whereas .samples[] is 0-indexed.
         */
        samples = allSamples ?
          sampleNumbers.map(i => allSamples[i-1]) : sampleNumbers,
        /** form/select-multiple uses .id (unique id) and .name (display name). */
        name = haplotype + ' ' + count + 
          (this.args.userSettings.showHaplotypesSamples ? ' ' + samples.join(',') : ''),
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
