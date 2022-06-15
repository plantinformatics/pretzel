import { get as Ember_get, set as Ember_set } from '@ember/object';


// -----------------------------------------------------------------------------

const dLog = console.debug;

/** number of columns in the vcf output before the first sample column. */
const nColumnsBeforeSamples = 9;

/** map from vcf column name to Feature field name.
 */
const vcfColumn2Feature = {
  'CHROM' : 'blockId',
  'POS' : 'value',
  'ID' : '_name',
  'REF' : 'values.ref',
  'ALT' : 'values.alt',
};

// -----------------------------------------------------------------------------

/* sample data :
##fileformat=VCFv4.1
##FILTER=<ID=PASS,Description="All filters passed">
##phasing=none
##INFO=<ID=NS,Number=1,Type=Integer,Description="Number of Samples With Data">

##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype as 0/1">

#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO	FORMAT	ExomeCapture-DAS5-003227	ExomeCapture-DAS5-002775	ExomeCapture-DAS5-002986
chr1A	327382120	scaffold22435_31704476	G	A	100	PASS	AC=3;AN=6;NS=616;MAF=0.418019;AC_Het=233;tSNP=.;pass=no;passRelaxed=no;selected=no	GT:GL:DP	1/0:-7.65918,-2.74391e-08,-7.48455:6	1/0:-5.41078,-0.00397816,-2.1981:3	1/0:-4.50477,-1.46346e-05,-10.5809:6
*/




/** Parse VCF output and add features to block.
 * @return array of created Features
 */
function addFeaturesJson(block, text) {
  const fnName = 'addFeaturesJson';
  dLog(fnName, block, text);
  /** optional : add fileformat, FILTER, phasing, INFO, FORMAT to block meta
   * read #CHROM column headers as feature field names
   * parse /^[^#]/ (chr) lines into features, add to block
   */
  let
  createdFeatures = [],
  lines = text.split('\n'),
  meta = {},
  columnNames,
  nFeatures = 0;
  lines.forEach((l, lineNum) => {
    if (l.startsWith('##')) {
      const nameVal = l.match(/^##([^=]+)=(.*)/);
      if (nameVal.length > 2) {
        /** ##INFO and ##FORMAT are duplicated : could .match(/.*ID=(.+),(.+)>/) and use ID to store [2] in meta.{INFO,FORMAT}.<ID>
         * ##bcftools_{viewVersion,viewCommand} are also duplicated, the last pair generated this output so it is of more interest.
         */
        meta[nameVal[1]] = nameVal[2];
      }
    } else if (l.startsWith('#CHROM')) {
      columnNames = l.slice(1).split('\t');
    } else if (columnNames && l.length) {
      const values = l.split('\t');
      let feature = values.reduce((f, value, i) => {
        const fieldName = columnNames[i];

        let fieldNameF;
        // overridden in the switch default.
        fieldNameF = vcfColumn2Feature[fieldName];
        /** maybe handle samples differently, e.g. Feature.values.samples: []
         * if (i > nColumnsBeforeSamples) { ... } else
         */
        switch (fieldName) {
        case 'CHROM' :
          let scope = value.replace(/^chr/, '');
          if (scope !== block.scope) {
            dLog(fnName, value, scope, block.scope, fieldName, i);
            value = null;
          } else {
            value = block;
          }
          break;

        case 'POS' :
          value = [ +value ];
          f['value_0'] = value;
          break;

        case 'ID' :
        case 'REF' :
        case 'ALT' :
          break;

        default :
          fieldNameF = 'values.' + fieldName;
        }
        if (! fieldNameF) {
          dLog(fnName, fieldName, value, i);
        } else {
          /** match values. and meta.  */
          let prefix = fieldNameF.match(/^(.+)\..*/);
          prefix = prefix && prefix[1];
          if (prefix) {
            if (! f[prefix]) {
              f[prefix] = {};
            }
            /* could use Ember_set() for both cases. */
            Ember_set(f, fieldNameF, value);
          } else {
            f[fieldNameF] = value;
          }
        }
        return f;
      }, {});
      // or EmberObject.create({value : []});

      /** based on similar : components/table-brushed.js : afterPaste()  */

      if (feature.blockId && feature.value.length && feature._name) {
        dLog(fnName, 'newFeature', feature);

        let mapChrName = Ember_get(feature, 'blockId.brushName');
        let selectionFeature = {Chromosome : mapChrName, Feature : feature.name, Position : feature.value[0], feature};

        createdFeatures.push(selectionFeature);

        // in this case feature.blockId is block
        let store = feature.blockId.get('store');

        // Replace Ember.Object() with models/feature.
        feature = store.createRecord('Feature', feature);
        nFeatures++;
      }

    }
  });

  if (! columnNames) {
    dLog(fnName, lines.length, text.length);
  }

  return createdFeatures;
}

export { addFeaturesJson };
