import Component from '@glimmer/component';

import { action } from '@ember/object';

import { thenOrNow } from '../../utils/common/promises';

// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------

export default class FormSelectMultipleComponent extends Component {
  // selectedValue;

  @action
  selectedGroupChangedId(selectedGroupId) {
    const fnName = 'selectedGroupChangedId';
    let
    gsP = this.args.values,
    selectedGroup = thenOrNow(gsP, (gs) => {
      let
      groupValue = gs.findBy('id', selectedGroupId);
      dLog(fnName, selectedGroupId, groupValue?.name, groupValue?.id, arguments, this);
      this.args.selectedGroupChanged(groupValue);
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
    ok = selectedValue.any(s => s.id === optionValue.id);
    dLog(fnName, ok, selectedValue, optionValue);
    return ok;
  }
}
