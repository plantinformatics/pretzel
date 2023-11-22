import Component from '@glimmer/component';
import { action } from '@ember/object';
import { later } from '@ember/runloop';


//------------------------------------------------------------------------------

const dLog = console.debug;

//------------------------------------------------------------------------------

/**
 * @param dataset	manageGenotype.intersectionDialogDataset
 * @param close	action (mut manageGenotype.intersectionDialogDataset)
 * @param positionFilterChanged	manageGenotype.positionFilterChanged
 * @param gtDatasetsLength  manageGenotype.gtDatasets.length
 */
export default class PanelDatasetIntersectionDialogComponent extends Component {

  //----------------------------------------------------------------------------

  /** @return dataset.positionFilter as text, for value of the radio-buttons
   * i.e. 'null', 'true', 'false'.
   * numeric values 1,2,.. count as 'true'
   */
  get positionFilterRadioValue() {
    const
    pf = this.args.dataset.positionFilter,
    /** dataset.positionFilter is initially undefined - treat as null.  */
    pfInit = (pf === undefined) ? null :
      (typeof pf === 'number') ? true : pf,
    text = '' + pfInit;
    dLog('positionFilterRadioValue', text, pf);

    return text;
  }
  set positionFilterRadioValue(text) {
    /** @param text originates from get positionFilterRadioValue(), so it is
     * lower case.
     */
    const positionFilter = JSON.parse(text);
    this.args.positionFilterChanged(positionFilter);
  }

  //----------------------------------------------------------------------------

  /** in .hbs, value=this.chooseK establishes a 2-way binding, which calls {get,set} chooseK(),
   * These 2 functions convert to/from the GUI view of .positionFilter,
   * i.e. converting to/from text.
   */
  get chooseK() {
    const
    dataset = this.args.dataset,
    positionFilter = dataset.positionFilter,
    kText = this.positionFilter2Text(positionFilter);
    return kText;
  }
  /**
   * input component calls set() then chooseKChanged() ; the constraint on
   * accepted values is implemented by text2PositionFilter(), called here;
   * may need chooseKChanged() to then show the limited value.
   */
  set chooseK(value) {
    const fnName = 'set chooseK';
    const
    dataset = this.args.dataset,
    positionFilter = dataset.positionFilter;
    const newValue = this.text2PositionFilter(value);
    dLog(fnName, newValue, value, positionFilter);
    dataset.positionFilter = newValue;
  }

  positionFilter2Text(positionFilter) {
    const text = typeof positionFilter === 'number' ? '' + positionFilter : '';
    return text;
  }
  text2PositionFilter(value) {
    const fnName = 'text2PositionFilter';
    let newValue;
    if ((value == '') || isNaN(value)) {
      newValue = true;
    } else {
      /** limit to the range [1, gtDatasetsLength - 1] */
      newValue = Math.min(this.args.gtDatasetsLength - 1, Math.max(1, +value));
      dLog(fnName, value, newValue, this.args.gtDatasetsLength);
    }
    return newValue;
  }

  @action
  chooseKChanged(value) {
    const fnName = 'chooseKChanged';
    dLog('fnName', value, value.target?.value, value.target);
    let target;
    /** as in elem/input-range-text.js : valueTextChanged() */
    if (value.target) {
      const proxy = value;
      target = proxy.target;
      value = target.value;
    }
    const
    dataset = this.args.dataset;
    /*
    const newValue = this.text2PositionFilter(value);
    dataset.set('positionFilter', newValue);
    */
    /** show empty string or an acceptable input. */
    const newValueText = this.positionFilter2Text(dataset.positionFilter);
    if (target && (target.value != newValueText)) {
      later(() => target.value = newValueText);
    }
    this.args.positionFilterChanged(dataset.positionFilter);
  }

  //----------------------------------------------------------------------------

}
