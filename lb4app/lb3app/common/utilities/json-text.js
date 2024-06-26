
/** global exports */

exports.flattenJSON = flattenJSON;

/** converts a JSON object into key-value pairs:
 * From Question :
Write a javascript function to convert JSON into key-value pairs, following this example :
JSON : {a : 1, b : {c: 23, d: 5}}
output : a=1 b.c=23 b.d=5
*/
function flattenJSON(json, prefix = '') {
  let keyValuePairs = [];

  for (let key in json) {
    if (json.hasOwnProperty(key)) {
      let value = json[key];

      // copies (dataset with .meta._origin) will normally be filtered out before this point.
      if ((value === null) || (value === '') || (Array.isArray(value) && ! value.length) ||
          (key === '_origin') || (typeof value === 'object' && value._bsontype) ) {
      } else
      if (typeof value === 'object' && value !== null) {
        let nestedPrefix = prefix ? `${prefix}.${key}` : key;
        let nestedPairs = flattenJSON(value, nestedPrefix);
        keyValuePairs.push(...nestedPairs);
      } else {
        let flatKey = prefix ? `${prefix}.${key}` : key;
        let pair = `${flatKey} : ${value}`;
        keyValuePairs.push(pair);
      }
    }
  }

  return keyValuePairs;
}


/**

You can use this function to convert the provided JSON into key-value pairs like this:

```javascript
let json = {
  a: 1,
  b: {
    c: 23,
    d: 5
  }
};

let keyValuePairs = flattenJSON(json);
console.log(keyValuePairs.join(' '));
```

This will output:
```
a=1 b.c=23 b.d=5
```

The `flattenJSON` function recursively traverses the JSON object and generates key-value pairs by concatenating the keys with their corresponding values. If a value is an object, it recursively calls itself with the nested object and prefixes the keys with the appropriate nesting level. Finally, the function returns an array of all the generated key-value pairs.
*/

//------------------------------------------------------------------------------

exports.parseBooleanFields = parseBooleanFields;
/** Handle boolean args in objects passed as remoteMethod params.  The boolean args are being received as  strings, e.g.
 * vcfGenotypeLookup() : preArgs : {... , requestInfo: 'false', requestFormat: 'Numerical', requestSamplesAll: 'true', snpPolymorphismFilter: 'false'}
 * Parse these to convert to native boolean values true, false.
 *
 * Use this also for numeric values - JSON.parse() works for those also, e.g.
 * Block.blockFeaturesCounts : userOptions : { ... mafThreshold : '0', ... }
 */
function parseBooleanFields(object, fieldNames) {
  fieldNames.forEach(fieldName => {
    if (typeof object[fieldName] === 'string') {
      /** trace confirmed this is used for : snpPolymorphismFilter,
       * mafThreshold, featureCallRateThreshold in blockFeaturesCounts. */
      // console.log('parseBooleanFields', fieldName, object[fieldName]);
      object[fieldName] = JSON.parse(object[fieldName]);
    }
  });
}

//------------------------------------------------------------------------------
