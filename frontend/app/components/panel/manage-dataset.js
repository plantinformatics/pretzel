import { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import ManageBase from './manage-base';

/** @param: dataset **/

const dLog = console.debug;
const trace = 0;

export default ManageBase.extend({
  editorVisible: false,
  currentMeta: {},

  jsoneditorOptions : {
    onEditable : function() { dLog('onEditable'); return false; }
  },

  ownedByMe: alias("dataset.owner"),
  datasetMeta: computed("dataset._meta", function() {
    let meta = this.get("dataset._meta") || {},
    apiHost = this.get("dataset.store.name");
    if (apiHost)
      meta.apiHost = apiHost;
    /** Copy to .currentMeta because :
     * ember-jsoneditor/addon/components/json-editor.js:  _change() does this.set('json', json);
     * so we can't pass {{json-editor json=datasetMeta ... }}
     */
    this.set('currentMeta', Object.assign({}, meta));
    return meta;
  }),

  actions: {
    toggleEditor() {
      this.toggleProperty('editorVisible');
    },
    mutateJson(json) {
      /*  mutateJson() is called after _change() has changed the json value
       *  passed (.currentMeta), so no need to change currentMeta here.
      if (trace > 1)
        dLog('mutateJson()', 'currentMeta => ', this.get("currentMeta"));
      this.set("currentMeta", json);
      */
      if (trace > 1)
        dLog('mutateJson()', 'currentMeta => ', this.get("currentMeta"));
      // this.get("dataset").save()
    },
    saveJSONToDB() {
      dLog('saveJSONToDB()', 'currentMeta', this.get("currentMeta"));
      this.set("dataset._meta", this.get("currentMeta"));
      this.get("dataset").save();
      this.send("toggleEditor");
    }
  },
});
