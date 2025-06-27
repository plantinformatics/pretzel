import StorageObject from 'ember-local-storage/local/object';

const Storage = StorageObject.extend();

const
initialData = {
  colours : {},
  dataLicenceAgreements : { genolink : null },
};


// Uncomment if you would like to set initialState
Storage.reopenClass({
  initialState() {
    return initialData;
  }
});

export default Storage;
