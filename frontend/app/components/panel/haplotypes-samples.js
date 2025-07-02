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

  /** Parse the data, and combine if the data is of multiple blocks.
   * @param @data array of haplotypeSamples text results from API
   * @return object { haplotype : samples, ... }
   */
  @computed(
    'args.data', 'args.the.samples',
    'args.userSettings.sortByHaplotypeValue',
    'args.userSettings.includeHetMissingHaplotypes',
  )
  get haplotypesSamples() {
    const fnName = 'haplotypesSamples';
    /** If there are no SNPs selected, data can be null.
     * genotype-samples only instantiates this component when
     * result.isResolved, but in this case there is no new request.  */
    if (! this.args.data || ! this.args.data.length) {
      dLog(fnName, '! @data');
      return [];
    }

    /** option : filter out missing / het.
     * It might be useful to instead use the filter to split into 2 groups, and
     * sort them separately, then concat. */
    function homValueFilter(value) {
      return ! value.haplotype.match(/[.1]/);
    }
    /** @return array, filtered by filter if flag */
    function optionalFilter(array, flag, filter) {
      return flag ? array.filter(filter) : array;
    }

    const userSettings = this.args.userSettings;

    function parseResult(data) {
      const
      parsed = data.trim().split('\n')
      .map(line => {
        const
        columns = line.split(' '),
        [haplotype, count, samplesText] = columns,
        hs = {haplotype, count: +count, samplesText};
        return hs;
      }),
      filtered = 
        optionalFilter(parsed, ! userSettings.includeHetMissingHaplotypes, homValueFilter);

      return filtered;
    }
    const
    /** 1 result per chromosome / Block */
    chromosomes = this.args.data
      .map(data => 
        parseResult(data)),
    withNames = chromosomes.map(map => this.sampleTextToNames(map)),
    haplotypes = withNames.length < 2 ? Object.fromEntries(withNames[0]) : this.combine(withNames);

    return haplotypes;
  }
  /** Given an entries array [[key, value], ... ] invert it to
   * {value : key, ... }
   */
  invertObjectArrays(entries) {
    const
    inverted = entries
      .reduce((inv, [key, values]) => { values.forEach(value => inv[value] = key); return inv; }, {});
    return inverted;
  }
  /** Combine haplotypesSamples results from multiple Blocks / chromosomes
   * @param blockMaps parsed and filtered results for the chromosomes of one dataset which have selected SNPs.
   * form is [Object.entries()] : [[[haplotype, samples], ...], ... ]
   * @return { haplotype : samples, ... }
   */
  combine(blockMaps) {
    const
    fnName = 'combine';
    /* e.g. for 2 chromosomes : (drafted by ChatGPT)
     *  for each sample in intersection(Object.keys(map1), Object.keys(map2)):
     *    value = map1[sample] + map2[sample]
     *    group results by value
     */
    /** Since all of blocks are from a single dataset, we expect the samples set to be the same. */
    const
    maps = blockMaps.map(this.invertObjectArrays),
    samples = Object.keys(maps[0]);
    maps.forEach(map => (Object.keys(map).length !== samples.length) && dLog(fnName, Object.keys(map).length, '!==', samples.length, map));
    const
    catenated = samples.map(sample => maps.map(m => m[sample]).join(' ')),
    grouped = catenated
      .reduce((group, value, i) => {
        const a = group[value] || (group[value] = []);
        a.push(samples[i]);
        return group;
      }, {});
    dLog(fnName, catenated, grouped, samples);
    return grouped;
  }

  /** Convert the result of haplotypesSamples() into text for display in the <select>
   */
  @computed('haplotypesSamples', 'args.userSettings.showHaplotypesSamples')
  get haplotypesSamplesText() {
    const
    fnName = 'haplotypesSamplesText',
    haplotypesSamples = this.haplotypesSamples,
    haplotypes = this.samplesForSelect(haplotypesSamples);
    return haplotypes;
  }
  /**
   * Uses manage-genotype .lookupDatasetId, which is the datasetId of the tab in
   * which .haplotypesSamplesText is displayed.
   * @return Object.entries() form [[key, value], ... ]
   */
  sampleTextToNames(haplotypesSamples) {
    const
    fnName = 'sampleTextToNames',
    mg = this.args.the,
    allSamplesText = mg.sampleCache.sampleNames[mg.lookupDatasetId],
    allSamples = allSamplesText?.split('\n'),
    haplotypes =
      haplotypesSamples.map(({haplotype, count, samplesText}) => {
        const
        /** first character is ',', so discard the first value.
         */
        sampleNumbers = samplesText.split(',').slice(1),
        /** sample column numbers in the API result are 1-indexed,
         * whereas .samples[] is 0-indexed.
         */
        samples = allSamples ?
          sampleNumbers.map(i => allSamples[i-1]) : sampleNumbers;
        if (sampleNumbers.length !== count) {
          dLog(fnName, sampleNumbers.length, '!==', count);
        }
        const hs = [haplotype, samples];
        return hs;
      });
    return haplotypes;
  }
  /**
   * @param haplotypesSamples	{ key : samples, ... }
   * where key is the "haplotype" or genotypic pattern or Multi-Locus Genotype (MLG).
   * If the user has selected SNPs across multiple chromosomes / Blocks of the dataset,
   * this value will be the catenated genotype values from those chromosomes / Blocks.
   */
  samplesForSelect(haplotypesSamples) {
    const
    userSettings = this.args.userSettings,
    keyName = userSettings.sortByHaplotypeValue ? 'haplotype' : 'count',
    fnName = 'samplesForSelect',
    haplotypes = Object.entries(haplotypesSamples)
      .map(([haplotype, samples]) => ({haplotype, samples, count : samples.length}))
      .sortBy(keyName)
      .reverse()
      .map(({haplotype, count, samples}) => {
        const
        /** It is possible to display hundreds of sample names in a single line,
         * but it doesn't seem useful. */
        displayLimit = 100,
        /** Limit the number of sample names displayed in each row. */
        /** form/select-multiple uses .id (unique id) and .name (display name). */
        name = haplotype + ' ' + count + 
          (! userSettings.showHaplotypesSamples ? '' :
           ' ' + samples.slice(0, displayLimit + 1).join(',')),
        hs = {haplotype, count, samples, id : haplotype, name};

        return hs;
      });
    return haplotypes;
  }

  //----------------------------------------------------------------------------

  /** defined if user has selected haplotypes, for samples to lookup. */
  @tracked
  haplotypesSelected = undefined;

  /** Called via user selection change in select-multiple
   * The parameters added and deleted indicate changes to the selection.
   * They are arrays of :
   *  { id, name, ... } Ember Object
   * See form/select-multiple.js : selectedGroupChangedId().
   *
   * @param added
   * @param deleted
   *
   * based on manage-explorer.js : selectedCategoryChanged()
   */
  @action
  selectedHaplotypeChanged(added, deleted) {
    const fnName = 'selectedHaplotypeChanged';

    const isMultiple = true;
    /* This would only be relevant if multiple was not used.
    if (selectedHaplotype === noHaplotype) {
      this.haplotypesSelected = null;
    } else if (! isMultiple) {
      this.haplotypesSelected = selectedHaplotype;
    } else */ {
      const
      haplotypes = this.haplotypesSelected || (this.haplotypesSelected = []);
      /** or c === selectedHaplotype */
      // present = haplotypes.find(c => c.id == selectedHaplotype.id);
      /** use .pushObject() (or .removeObject) so that () sees the
       * change to its dependency haplotypesSelected.length */
      const
      /** changes[add=true] === added. */
      changes = [deleted, added];
      /** delete then add. */
      [false, true].forEach(add => {
        const change = changes[+add];
        change.forEach(c => {
          if (add) {
            haplotypes.pushObject(c);
          } else {
            haplotypes.removeObject(c);
          }
          const samples = c.samples;
          this.args.the.selectSampleArray(samples, add);
        });
      });
    }
    dLog(fnName, added, deleted, this.haplotypesSelected);
  }

  //----------------------------------------------------------------------------

}
