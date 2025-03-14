import Component from '@glimmer/component';
import { action } from '@ember/object';

import { thenOrNow } from '../../utils/common/promises';

// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------

export default class FormSelectGroupComponent extends Component {
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

}
