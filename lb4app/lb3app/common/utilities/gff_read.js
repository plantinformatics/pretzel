const { pick } = require('lodash/object');

const gff = require('@gmod/gff').default;
const { parseStream, parseStringSync } = gff;

const { maybeFlip } = require('./interval-overlap');

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


class GffParse {
  /** current block, feature
  let block, feature;
  */

  /**
   * @param fileData
   * @param datasetAttributes Object
   * Required fields : name (or the caller can set result.dataset.name)
   * Optional fields : parent, namespace.
   * @return : {dataset}
   *
   * Caller :  Dataset.gffUploadInternal() 
   */
  gffDataToJsObj(fileData, datasetAttributes) {
    const fnName = 'gffDataToJsObj';
    const
    gffObj = parseStringSync(fileData),
    dataset = this.dataset = this.startDataset(datasetAttributes),
    datasetObj = gffObj.reduce(
      this.featureParsed.bind(this),
      { dataset } );

    return datasetObj;
  }

  startDataset(datasetAttributes) {
    const
    /** based on {dataset,block,Feature}Header in pretzel/resources/tools/dev/gff32Dataset.pl */
    dataset = Object.assign(
      {
        type : 'linear',
        tags : [
          'geneElements'
        ],
        meta : { shortName : 'IWGSC_genes_HC'  },
        blocks : [],
      }, datasetAttributes);
    return dataset;
  }

  /** pipe the message body contents into the gff parser.
   * @return : promise yielding {dataset}
   */
  bodyPipe(req) {
    let result = { dataset : this.dataset };
    const promise = new Promise((resolve, reject) => {
      req
        .pipe(gff.parseStream({ parseAll: true }))
        .on('data', (data) => {
          if (data.directive) {
            console.log('got a directive', data);
          } else if (data.comment) {
            console.log('got a comment', data);
          } else if (data.sequence) {
            console.log('got a sequence from a FASTA section');
          } else {
            // console.log('got a feature', data);
            result = this.featureParsed(result, data);
          }
        })
      // refn : @gmod/gff/src/gff-to-json.ts
        .on('error', (err) => {
          console.error(err);
          reject(err);
        })
        .on('end', () => {
          resolve(result);
        });
    });
    return promise;
  }

  /**
   * @param result { dataset }
   * @param g parsed feature data
   */
  featureParsed(result, g)  {
    const fnName = 'featureParsed';
    if (Array.isArray(g)) {
      if (g.length !== 1) {
        console.log(fnName, 'g.length !== 1', g);
      } else {
        g = g[0];
      }
    }
    /** not used :
     * derived_features:[]
     */
    const {Name, chromosome} = g.attributes;
    // if ((g.genome.length === 1) && (g.genome.length[0] === 'chromosome'))
    switch (g.type) {
    case 'region' :
      this.block = this.newBlock(g, Name[0], chromosome[0]);
      break;
    case 'gene':
    case 'match':
      let scope;
      if (! chromosome && (g.type === 'match')) {
        scope = g.attributes?.description[0]?.match(/^([^ ]+) /)?.[1];
      } else {
        scope = chromosome ? chromosome[0] : g.seq_id;
      }
      if (! this.block || (this.block.scope !== scope)) {
        this.block = this.newBlock(g, scope, scope);
      }
      this.feature = this.addFeature(g);
      break;
    default :
      console.log(fnName, 'g.type', g.type);
      break;
    }
    return result;
  }

  newBlock(g, name, scope) {
    const
    block = {
      name,
      scope,
      features : [],
      // range : [g.start, g.end],
    };
    this.dataset.blocks.push(block);
    return block;
  }

  addFeature(g) {
    const
    fnName = 'addFeature',
    values = pickNonNull(g, ['ID', 'score', 'strand', 'phase']),
    a = g.attributes,
    name = (g.type === 'match') ?
      g.seq_id + '_' + g.attributes.ID :
      g.attributes.Name[0],
    value = featureValue(g),
    feature = {
      name,
      value,
      value_0 : value[0],
      values,
    };
    if (g.attributes) {
      /* ID is defined in g.attributes in iwgsc_refseqv2.1_annotation_200916_LC,
       * and in g in GCF_018294505.1_IWGSC_CS_RefSeq_v2.1_genomic.gff
       * There don't appear to be any field names overlapping between g.attributes and g
       */
      Object.assign(values, g.attributes);
    }
    this.block.features.push(feature);
    let
    /** children, currently stored as feature.value[2] */
    subElements = feature.value[2];
    subElements = visitChildren(feature, subElements, g);
    if (subElements?.length) {
      feature.value[2] = subElements;
    }

    return feature;
  }

} // GffParse
exports.GffParse = GffParse;

function featureValue(g) {
  const
  a = g.attributes,
  /** gff generated from blast results has g.attributes.blast_sbjct_{start,end}
   * which are close to the gene position, and g.start which is -ve,
   *   start = blast_query_start - blast_sbjct_start + 1
   *   end = blast_query_end + 1
   * so use blast_sbjct_{start,end} in this case.
   */
  valueDir = (a.blast_sbjct_start !== undefined) ? 
    [+a.blast_sbjct_start[0], +a.blast_sbjct_end[0]] :
    [g.start, g.end],
  /** valueDir is directional, but -ve block domain is not currently handled. */
  value = maybeFlip(valueDir, valueDir[0] > valueDir[1]);
  return value;
}



function visitChildren(feature, subElements, g) {
  const fnName = 'visitChildren';
  if (g.child_features.length) {
    /** g.child_features seems to also be [Array[1]]  */
    subElements = g.child_features
      .reduce((children, g) => {
        if (Array.isArray(g)) {
          if (g.length !== 1) {
            console.log(fnName, 'g.length !== 1', g);
          } else {
            g = g[0];
          }
        }
        /** if interval is the same as the current feature, just merge the attributes in. */
        if ((feature.value[0] === g.start) && (feature.value[1] === g.end)) {
          const childTypes = feature.values.childTypes || (feature.values.childTypes = []);
          childTypes.push(g.type);
        } else {
          if (! children) {
            children = [];
          }
          children.push(childFeature(feature.value, g));
        }
        children = visitChildren(feature, children, g);
        return children;
      }, subElements);
  }
  return subElements;
}
function childFeature(parentValue, g) {
  const
  childValue = featureValue(g),
  /** it looks like the child values are relative, perhaps relative to the parent feature start.  */
  value = (g.type === 'match_part') ?
    childValue.map(v => v + parentValue[0]) :
    childValue,
  // print '[', $a[start], ',', $a[end], ', "', $a[type], '"]';
  child = [value[0], value[1], g.type];
  return child;
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
