const { pick } = require('lodash/object');

const gff = require('@gmod/gff').default;
const { parseStream, parseStringSync } = gff;


/* global exports */
/* global require */

//------------------------------------------------------------------------------

//------------------------------------------------------------------------------

const trace = 1;

//------------------------------------------------------------------------------

/** sample data line from .gff :
NC_057804.1	Gnomon	gene	123211	124664	.	-	.	ID=gene-LOC543023;Dbxref=GeneID:543023;Name=LOC543023;gbkey=Gene;gene=LOC543023;gene_biotype=protein_coding
 *
 * column[1] is e.g. Gnomon|cmsearch|tRNAscan-SE|cDNA_match
 */

/**
[{"seq_id":"NC_057794.1","source":"RefSeq","type":"region","start":1,"end":598660471,"score":null,"strand":"+","phase":null,"attributes":{"ID":["NC_057794.1:1..598660471"],"Dbxref":["taxon:4565"],"Name":["1A"],"chromosome":["1A"],"country":["USA: Davis, California"],"cultivar":["Chinese Spring"],"dev-stage":["Vegetative"],"gbkey":["Src"],"genome":["chromosome"],"mol_type":["genomic DNA"],"tissue-type":["leaf"]},"child_features":[],"derived_features":[]},
 {"seq_id":"NC_057794.1","source":"cmsearch","type":"gene","start":5023,"end":6833,"score":null,"strand":"+","phase":null,"attributes":{"ID":["gene-LOC123073777"],"Dbxref":["GeneID:123073777"],"Name":["LOC123073777"],"gbkey":["Gene"],"gene":["LOC123073777"],"gene_biotype":["rRNA"]},"child_features":[
   [{"seq_id":"NC_057794.1","source":"cmsearch","type":"rRNA","start":5023,"end":6833,"score":null,"strand":"+","phase":null,"attributes":{"ID":["rna-XR_006435738.1"],"Parent":["gene-LOC123073777"],"Dbxref":["GeneID:123073777","RFAM:RF01960","Genbank:XR_006435738.1"],"Name":["XR_006435738.1"],"gbkey":["rRNA"],"gene":["LOC123073777"],"inference":["COORDINATES: profile:INFERNAL:1.1.1"],"product":["18S ribosomal RNA"],"transcript_id":["XR_006435738.1"]},"child_features":[
     [{"seq_id":"NC_057794.1","source":"cmsearch","type":"exon","start":5023,"end":6833,"score":null,"strand":"+","phase":null,"attributes":{"ID":["exon-XR_006435738.1-1"],"Parent":["rna-XR_006435738.1"],"Dbxref":["GeneID:123073777","RFAM:RF01960","Genbank:XR_006435738.1"],"gbkey":["rRNA"],"gene":["LOC123073777"],"inference":["COORDINATES: profile:INFERNAL:1.1.1"],"product":["18S ribosomal RNA"],"transcript_id":["XR_006435738.1"]},"child_features":[],"derived_features":[]}]],"derived_features":[]}]],"derived_features":[]},

[{"seq_id":"NC_057794.1","source":"RefSeq","type":"region"
... "Name":["1A"],"chromosome":["1A"]
... "genome":["chromosome"]

types :
region  |
gene	|	rRNA	|	exon	|	pseudogene	|	lnc_RNA	|	CDS	|	mRNA	|	transcript	|	snoRNA	|	tRNA	|	snRNA	|	cDNA_match
Correlate with frontend/app/components/axis-tracks.js : ShapeDescription : constructor().
*/

//------------------------------------------------------------------------------


exports.gffDataToJsObj = gffDataToJsObj;
/**
 * @param fileData
 * @param datasetAttributes Object
 * Required fields : name
 * Optional fields : parent, namespace.
 * @return : {errors, warnings, datasets[], datasetNames}
 * datasets[] may have .errors and .warnings
 *
 * Caller :  Dataset.gffUploadInternal() 
 */
function gffDataToJsObj(fileData, datasetAttributes) {
  const fnName = 'gffDataToJsObj';
  /** current block, feature */
  let block, feature;
  const
  gffObj = parseStringSync(fileData),

  /** based on {dataset,block,Feature}Header in pretzel/resources/tools/dev/gff32Dataset.pl */
  dataset = Object.assign(
    {
      type : 'linear',
      tags : [
        'geneElements'
      ],
      meta : { shortName : 'IWGSC_genes_HC'  },
      blocks : [],
    }, datasetAttributes),
  datasetObj = gffObj.reduce(
    (result, g) => {
      if (g.length !== 1) {
        console.log(fnName, 'g.length !== 1', g);
      } else {
        g = g[0];
      }
      /** not used :
       * derived_features:[]
       */
      // if ((g.genome.length === 1) && (g.genome.length[0] === 'chromosome'))
      switch (g.type) {
      case 'region' :
        const {Name, chromosome} = g.attributes;
        block = {
          name : Name[0],
          scope : chromosome[0],
          features : [],
          // range : [g.start, g.end],
        };
        dataset.blocks.push(block);
        break;
      case 'gene':
        feature = addFeature(g);
        break;
      default :
        console.log(fnName, 'g.type', g.type);
        break;
      }
      return result;
    },
    { dataset } );

  function addFeature(g) {
    const
    fnName = 'addFeature',
    values = pickNonNull(g, ['attributes', 'ID', 'score', 'strand', 'phase']),
    feature = {
      name : g.attributes.Name[0],
      value : [g.start, g.end],
      value_0 : g.start,
      values,
    };
    block.features.push(feature);
    if (g.child_features.length) {
      const
      child_features = g.child_features
        .reduce((children, g) => {
          if (g.length !== 1) {
            console.log(fnName, 'g.length !== 1', g);
          } else {
            g = g[0];
          }
          /** if interval is the same as the current feature, just merge the attributes in. */
          if ((feature.value[0] === g.start) && (feature.value[1] === g.end)) {
            const childTypes = feature.values.childTypes || (feature.values.childTypes = []);
            childTypes.push(g.type);
          } else {
            children.push(childFeature(g));
          }
          return children;
        }, []);
      if (child_features.length) {
        /** children, currently stored as feature.value[2] */
        feature.value[2] = child_features;
      }
    }
    return feature;
  }
  function childFeature(a) {
    const
    // print '[', $a[start], ',', $a[end], ', "', $a[type], '"]';
    child = [a.start, a.end, a.type];
    return child;
  }


  return datasetObj;
}

function x1(fileData) {
  let status = {
    errors : [],
    warnings : [] };

  const
  features = fileData.split('\n').map(line => {
    const
    valuesColumnText = line[8],
    pairs = valuesColumnText.split(';'),
    values = pairs.map(s => s.split('='));
    feature = {values};
    return feature;
  });
  dataset = null;
}

//------------------------------------------------------------------------------

/** Based on lodash pick(), pick attributes whose value is not null or undefined.
 */
function pickNonNull(obj, attrNames) {
  const
  picked = pick(obj, attrNames),
  entries = Object.entries(picked).filter(([key, value]) => ((value ?? null) !== null));
  return Object.fromEntries(entries);
}

//------------------------------------------------------------------------------
