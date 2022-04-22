import Controller from '@ember/controller';
import { computed, action } from '@ember/object';

// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------

export default class GroupController extends Controller {

  editingName = false;
  @action
  reset() {
    this.editingName = false;
  }


  @action
  changeGroupName(group, newName) {
    const
    fnName = 'changeGroupName',
    msgName = fnName + 'Msg';
    group.name = newName;
    group.save()
      .then((g) => {
        dLog(fnName, g.name, group.name, newName);
      })
      .catch((error) => {
        const errorDetail = error?.errors[0];
        dLog(fnName, errorDetail || error);
        if (errorDetail?.status === '404') {
          error = 'Unable to set name because this group no longer exists.';
        }
        this.set(msgName, error);
        this.send('refreshModel');
      });

  }

}
