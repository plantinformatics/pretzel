import ManageBase from './manage-base';

export default ManageBase.extend({

    actions: {

    updateFeaturesInBlocks(featuresInBlocks) {
      this.sendAction('updateFeaturesInBlocks', featuresInBlocks);
    }
  }

  });
