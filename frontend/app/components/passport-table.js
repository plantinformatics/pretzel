import Component from '@glimmer/component';
import { action, computed } from '@ember/object';
import { tracked } from '@glimmer/tracking';

//------------------------------------------------------------------------------

const dLog = console.debug;

//------------------------------------------------------------------------------


export default class PassportTable extends Component {

  //----------------------------------------------------------------------------

  /** Display table rows in pages */
  pageLength = 20;  // probably this.args.pageLength ??, from urlOptions
  @tracked
  /** end row of last page of Passport data requested.  */
  lastPassport = 0;

  //----------------------------------------------------------------------------

  constructor() {
    super(...arguments);

    if (window.PretzelFrontend) {
      window.PretzelFrontend.passportTable = this;
    }
    const a = this.args;
    dLog(
      'PassportTable', 'constructor', 
      // 'the', a.the,
      'userSettings', a.userSettings,
      'dataset', a.dataset,
      'samples', a.samples,
      'rows', a.rows,
      'selectSampleArray', a.selectSampleArray,
      'tableRow', a.tableRow,
      'sampleNamePassportValues', a.sampleNamePassportValues,
      'this', this);
  }


  //----------------------------------------------------------------------------

  @action
  getNextPage() {
    /** get next chunk */
    const
    fnName = 'getNextPage',
    lastPassport = this.lastPassport,
    lastPassportNew = this.lastPassport += this.pageLength,
    /** could filter [0, lastPassportNew] @samples for selectFields; group by
     * required fields and request in groups. */
    sampleNames = this.args.samples.slice(lastPassport, lastPassportNew), 
    selectFields = this.args.userSettings.passportFields;
    dLog(fnName, lastPassport, this.lastPassport, this.pageLength);
    if (selectFields.length) {
      this.args.mg.datasetGetPassportData(this.args.dataset, sampleNames, selectFields);
    }
  }

 
  //----------------------------------------------------------------------------


}
