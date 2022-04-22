import Component from '@glimmer/component';
import { action } from '@ember/object';

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
    selectedGroup = gsP.then((gs) => {
      let
      groupValue = gs.findBy('id', selectedGroupId);
      dLog(fnName, selectedGroupId, groupValue?.name, groupValue?.id, arguments, this);
      this.args.selectedGroupChanged(groupValue);
    });
  }

}
