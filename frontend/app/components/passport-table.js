import Component from '@glimmer/component';

//------------------------------------------------------------------------------

const dLog = console.debug;

//------------------------------------------------------------------------------


export default class PassportTable extends Component {

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

}
