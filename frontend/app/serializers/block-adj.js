import DS from 'ember-data';

export default DS.JSONAPISerializer.extend({
  compositeKeys: ['block0', 'block1'],

  extractId(modelClass, resourceHash) {
    // console.log('extractId', modelClass, resourceHash);
    let i0 = this.compositeKeys.map((key) => {let i = resourceHash[key]; /* console.log('extractId', i);*/ return i; }).join('-');
  // console.log('extractId', i0);
  return i0;
  }
});
