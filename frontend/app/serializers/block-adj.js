import DS from 'ember-data';

const trace_extract = 2;

export default DS.JSONAPISerializer.extend({
  compositeKeys: ['block-id0', 'block-id1'],

  extractId(modelClass, resourceHash) {
     console.log('extractId', modelClass, resourceHash);
    let i0 = this.compositeKeys.map(
      (key) => {
        let i = resourceHash.attributes[key];
        if (! i || (trace_extract > 1) )
        { console.log('extractId', key, i); }
        return i;
      })
      .join('_');
    if (trace_extract)
   console.log('extractId', i0);
  return i0;
  }
});
