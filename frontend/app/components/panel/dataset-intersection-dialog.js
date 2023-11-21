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

  @action
  chooseKChanged(value) {
    let target;
    /** as in elem/input-range-text.js : valueTextChanged() */
    if (value.target) {
      const proxy = value;
      target = proxy.target;
      value = target.value;
    }
    const
    fnName = 'chooseKChanged',
    dataset = this.args.dataset;
    let newValue;
    if ((value == '') || isNaN(value)) {
      newValue = true;
    } else {
      const
      limited = Math.min(this.args.gtDatasetsLength - 1, Math.max(1, +value));
      dLog(fnName, value, limited, this.args.gtDatasetsLength, dataset.positionFilter);
      newValue = limited;
    }
    dataset.set('positionFilter', newValue);
    /** show empty string or an acceptable input. */
    if (target && (target.value != newValue)) {
      later(() => target.value = newValue);
    }
  }

  //----------------------------------------------------------------------------

}
