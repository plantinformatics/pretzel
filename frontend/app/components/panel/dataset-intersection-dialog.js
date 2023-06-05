import Component from '@glimmer/component';

//------------------------------------------------------------------------------

const dLog = console.debug;

//------------------------------------------------------------------------------

export default class PanelDatasetIntersectionDialogComponent extends Component {

  //----------------------------------------------------------------------------

  /** @return dataset.positionFilter as text, for value of the radio-buttons
   * i.e. 'null', 'true', 'false'.
   */
  get positionFilterRadioValue() {
    const
    pf = this.args.dataset.positionFilter,
    /** dataset.positionFilter is initially undefined - treat as null.  */
    pfInit = (pf === undefined) ? null : pf,
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

}
