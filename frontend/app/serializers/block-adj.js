import JSONAPISerializer from '@ember-data/serializer/json-api';

const trace_extract = 0;
const dLog = console.debug;

export default JSONAPISerializer.extend({
  compositeKeys: ['block-id0', 'block-id1'],

  extractId(modelClass, resourceHash) {
    if (trace_extract)
     dLog('extractId', modelClass, resourceHash);
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
