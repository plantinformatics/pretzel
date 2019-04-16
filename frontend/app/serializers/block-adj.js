import DS from 'ember-data';

export default DS.JSONAPISerializer.extend({
  compositeKeys: ['block-id0', 'block-id1'],

  extractId(modelClass, resourceHash) {
     console.log('extractId', modelClass, resourceHash);
    let i0 = this.compositeKeys.map((key) => {let i = resourceHash.attributes[key]; /* console.log('extractId', i);*/ return i; }).join('_');
   console.log('extractId', i0);
  return i0;
  }
});
