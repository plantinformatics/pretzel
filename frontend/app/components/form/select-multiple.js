import Component from '@glimmer/component';

import { action } from '@ember/object';

import { thenOrNow } from '../../utils/common/promises';

// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------

export default class FormSelectMultipleComponent extends Component {
  // selectedValue;

  /** The options of <select> which were selected before the current click. */
  selectedOptionsPrevious = new Set();

  /** Receive the onchange event.
   *
   * The event.target.value when <select> has 'multiple' attribute is just the
   * first of the currently selected options (after the current click).
   * So it is necessary to monitor select.selectedOptions for changes.
   *
   * This is done by storing the previous set of .selectedOptions in
   * this.selectedOptionsPrevious, and passing the difference (added & deleted)
   * to the given @selectedGroupChanged().
   *
   * @param event
   */
  @action
  selectedGroupChangedId(event) {
    const fnName = 'selectedGroupChangedId';
    let
    /** select-group.js handles @values optionally being a promise at this
     * point; that is not required for haplotypes-samples. */
    gsP = this.args.values,
    selectedGroup = thenOrNow(gsP, (gs) => {
      const
      select = event.target,
      current = new Set(Array.from(select.selectedOptions).mapBy('value')),
      previous = this.selectedOptionsPrevious,
      addedSet = current.difference(previous),
      deletedSet = previous.difference(current),
      valueForId = id => gs.findBy('id', id),
      added = Array.from(addedSet).map(valueForId),
      deleted = Array.from(deletedSet).map(valueForId);
      this.selectedOptionsPrevious = current;
      dLog(fnName, select.value);
      this.args.selectedGroupChanged(added, deleted);
    });
  }

  @action
  /**
   * @param selectedValue @selectedValue  i.e. currently selected values
   * @param optionValue {id, name} of the selected row
   * selected seems to be not used for multiple.
   */
  selected(selectedValue, optionValue) {
    const
    fnName = 'selected',
    /** The parent component is permitted to pass @selectedValue=undefined or
     * null, which is interpreted as [].  e.g. panel/haplotypes-samples does
     * this.
     */
    ok = selectedValue?.any(s => s.id === optionValue.id);
    // dLog(fnName, ok, selectedValue, optionValue);
    return ok;
  }
}
