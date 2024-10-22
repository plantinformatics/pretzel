import { on } from '@ember/object/evented';
import { computed } from '@ember/object';
import Component from '@ember/component';
import { inject as service } from '@ember/service';
import { run } from '@ember/runloop';

import { dLog } from '../../utils/common/log';

export default Component.extend({
  onInit: on('init', function() {
    this.set('editing', false);
  }),
  noAuth: computed(function() {
    return window['AUTH'] === 'NONE';
  }),
  actions: {
    setEditing: function(editing) {
      this.set('editing', editing);
      /** included when this function was added in 3127058e, there is
       * no action setEditing other than this function, and presumably
       * this had no effect :
       *   this.sendAction('setEditing', editing);
       */
    },
    enableEdit: function() {
      this.send('setEditing', true);
    },
    cancelEdit: function(record) {
      this.send('setEditing', false);
      record.rollbackAttributes();
    },
    saveEdit: function(record) {
      if (record.get('name').length > 0) {
        this.send('setEditing', false);
        record.save();
      }
    },
    flipPublic: function(record) {
      // alter publicity boolean for record
      let visible = record.get('public');
      record.set('public', !visible);
      record.save();
    },
    flipReadOnly: function(record) {
      // alter editability boolean for record
      let visible = record.get('readOnly');
      record.set('readOnly', !visible);
      record.save();
    },
    /** not used */
    selectRecord(record) {
      let modelName = record?.get('constructor.modelName');
      dLog('selectRecord', record?.id, record, modelName);
    },
    deleteRecord(record) {
      const fnName = 'deleteRecord';
      let id = record.id;

      let modelName = record.get('constructor.modelName');
      dLog(fnName, modelName, id, this?.entry?.id, this?._debugContainerKey);
      /** onDelete() un-views the block or the blocks of the dataset;
       * This is done before deleting it. */
      this.onDelete(modelName, id);

      // destroyRecord() is equivalent to deleteRecord() and immediate save()
      record.destroyRecord()
        .then(() => run(() => record.unloadRecord()))
        .then(() => {
          dLog(fnName, 'unloadRecord completed', modelName, id);
          /** .refreshDatasets is passed to entry-dataset, and it
           * passes it to entry-block, but other uses of entry-block
           * do not */
          this.get('refreshDatasets')?.();
      });
    },
    loadBlock(record) {
      this.loadBlock(record);
    }
  }
});
