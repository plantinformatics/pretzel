import Controller from '@ember/controller';
import { computed, action } from '@ember/object';
import { alias } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import { getOwner } from '@ember/application';

// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------

export default class GroupController extends Controller {
  @service apiServers;

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

  /** model is group */
  @alias('model') group;
  @alias('model.server') server;

  @action
  setWritable(writable) {
    /** based on controllers/groups.js : setIsVisible() */ 
    const
    fnName = 'setWritable',
    msgName = fnName + 'Msg',
    group = this.model;
    dLog(fnName, this, writable);
    if (this.isDeleted || this.isDestroying) {
      this.send('refreshModel');
    } else {
      this.set(msgName, null);
      group.set('writable', writable);
      group.save()
        .then((g) => {
          dLog(fnName, g.writable, group.writable);
          // this.send('refreshModel');
        })
        .catch((errorText) => {
          const errorDetail = errorText?.errors[0];
          dLog(fnName, errorDetail || errorText);
          if (errorDetail?.status === '404') {
            errorText = 'Unable to set writable because this group no longer exists.';
          }
          this.set(msgName, errorText);
          this.send('refreshModel');
        });
    }
  }


}
