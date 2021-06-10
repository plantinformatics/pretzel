import { debounce, later as run_later } from '@ember/runloop';
import { observer, computed } from '@ember/object';


const dLog = console.debug;

/*----------------------------------------------------------------------------*/


/**
 * factored from components/panel/upload/data-csv.js
 * May evolve this to a decorator or a sub-component.
 *
 * usage / dependencies : object using this defines :
 * services : store, auth
 * attributes :
  selectedDataset: 'new',
  newDatasetName: '',
  nameWarning: null,
  selectedParent: '',
  dataType: 'linear',
  namespace: '',

 */ 

export default {

  /** Returns a selected dataset name OR
   *  Attempts to create a new dataset with entered name */
  getDatasetId() {
    var that = this;
    let datasets = that.get('datasets');
    return new Promise(function(resolve, reject) {
      var selectedMap = that.get('selectDataset');
      // If a selected dataset, can simply return it
      // If no selectedMap, treat as default, 'new'
      if (selectedMap && selectedMap !== 'new') {
        resolve(selectedMap);
      } else {
        var newMap = that.get('newDatasetName');
        // Check if duplicate name
        let matched = datasets.findBy('name', newMap);
        if(matched){
          reject({ msg: `Dataset name '${newMap}' is already in use` });
        } else {
          let newDetails = {
            name: newMap,
            type: that.get('dataType'),
            namespace: that.get('namespace'),
            blocks: []
          };
          let parentId = that.get('selectedParent');
          if (parentId && parentId.length > 0) {
            newDetails.parentName = parentId;
          }
          let newDataset = that.get('store').createRecord('Dataset', newDetails);
          newDataset.save().then(() => {
            resolve(newDataset.id);
          });
        }
      }
    });
  },


  /** Checks if entered dataset name is already taken in dataset list
   *  Debounced call through observer */
  isDupName: function() {
    let selectedMap = this.get('selectedDataset');
    if (selectedMap === 'new') {
      let newMap = this.get('newDatasetName');
      let datasets = this.get('datasets');
      let matched = datasets.findBy('name', newMap);
      if(matched){
        this.set('nameWarning', `Dataset name '${newMap}' is already in use`);
        return true;
      }
    }
    this.set('nameWarning', null);
    return false;
  },

  onNameChange // : observer('newDatasetName', function),
  () {
    debounce(this, this.isDupName, 500);
  },

  onSelectChange // : observer('selectedDataset', 'selectedParent', function    ),
  () {
    this.clearMsgs();
    this.isDupName();
    this.checkBlocks();
  },

    submitFile() {
      const fnName = 'submitFile';
      var that = this;
      that.clearMsgs();
      that.set('nameWarning', null);
      var table = that.get('table');
      // 1. Check data and get cleaned copy
      let validateData = (that.validateData && (() => that.validateData())) ||
          (that.dataPipe.validateData && (() => that.dataPipe.validateData()));
      validateData()
      .then((features) => {
        if (features.length > 0) {
          // 2. Get new or selected dataset name
          that.getDatasetId().then((map_id) => {
            var data = {
              dataset_id: map_id,
              parentName: that.get('selectedParent'),
              features: features,
              namespace: that.get('namespace'),
            };
            that.setProcessing();
            that.scrollToTop();
            // 3. Submit upload to api
            that.get('auth').tableUpload(data, that.updateProgress.bind(that))
            .then((res) => {
              that.setSuccess(res.status);
              that.scrollToTop();
              // On complete, trigger dataset list reload
              // through controller-level function
              let refreshed = that.get('refreshDatasets')();
              /* as in sequence-search.js : dnaSequenceInput() */
              const viewDataset = this.get('viewDatasetFlag');
              if (viewDataset) {
                refreshed
                  .then(() => {
                    let
                    datasetName = map_id;
                    dLog(fnName, 'viewDataset', datasetName);
                    this.get('viewDataset')(datasetName, viewDataset);
                  });
              }

            }, (err, status) => {
              console.log(err, status);
              that.setError(err.responseJSON.error.message);
              that.scrollToTop();
              if(that.get('selectedDataset') === 'new'){
                // If upload failed and here, a new record for new dataset name
                // has been created by getDatasetId() and this should be undone
                that.get('store')
                  .findRecord('Dataset', map_id, { reload: true })
                  .then((rec) => rec.destroyRecord()
                    .then(() => rec.unloadRecord())
                  );
              }
            });
          }, (err) => {
            that.setError(err.msg || err.message);
            that.scrollToTop();
          });
        }
      }, (err) => {
        table.selectCell(err.r, err.c);
        that.setError(err.msg);
        that.scrollToTop();
      });
    },

};
