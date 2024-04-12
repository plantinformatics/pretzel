import { stringCountString } from '../../utils/string';
import { defaultCmp } from '../../utils/common/arrays';

//------------------------------------------------------------------------------

const dLog = console.debug;

const unicodeDot = '·';

//------------------------------------------------------------------------------

export { statusToMatrix };

/**
 * @param vcfStatus result from getFeaturesCountsStatus() :
 *  text ls -gG of $vcfDir/<datasetId>/*.vcf.gz*, with the mode and link count sliced off.
 * @return {rows, table, columnNames}
 * where, for colName in columnNames[],  and rowIndex is chrIndex
 * rows[rowIndex][colName] -> sizeTime
 * and also table[rowIndex][columnIndex] -> sizeTime
 * data-table uses .rows
 */
function statusToMatrix(vcfStatus) {
  const
  fnName = 'statusToMatrix',
  a = vcfStatus.split('\n'),
  /** collated into a summary object[chrName][colName] -> sizeTime
   * This has the same information as map; combined with cols[] this enables
   * producing a matrix with sorted column names.
   */
  s = {},
  cols = [],
  /** map : suffix -> column number */
  map = a.reduce((ma, line) => {
    const
    m = line.match(/(.*) ([^.]+)(.*).vcf.gz(.*)/);
    // Array(5) [ "   3288524 Sep 26 14:13 1A.MAF.SNPList.vcf.gz", "   3288524 Sep 26 14:13", "1A", ".MAF.SNPList", "" ]
    if (m) {
      /**  The dataset name may contain a '.', e.g. 
       * Ta_PRJEB31218_IWGSC-RefSeq-v1.0_filtered-SNPs.chr1A.vcf.gz
       * Perhaps handle with a regexp which [^-_] in the chr part;
       * trialling this heuristic : expect the chr part to be 2-5 chars.
       * Leading parts of m[3] (split at '.') which are > 5 chars are
       * moved to m[2].
       */
      const
      parts = m[3]?.split('.'),
      i = parts?.findIndex(part => part.length > 0 && part.length <= 5);
      if (i > 0) {
        const
        /** ".0_filtered-SNPs" */
        namePart = parts.slice(0, i).join('.'),
        /** "chr1A" */
        chrPart = parts.slice(i).join('.');
        m[2] += namePart;
        m[3] = '.' + chrPart;
      }

      const
      [whole, sizeTime, chrName, suffix, csi] = m,
      colName = (suffix + csi).replaceAll('.', unicodeDot),
      chr = s[chrName] || (s[chrName] = {});
      s[chrName][colName] = sizeTime;
      if (! ma.has(colName)) {
        const column = cols.length;
        cols.push(colName);
        ma.set(colName, column);
        /* if column sort was not required, could do :
         * table[column][chrRow] = sizeTime; */
      }
    }
    return ma;
  }, new Map()),
  colsSorted = cols.sort(vcfFileCmp),
  chrNames = Object.keys(s),
  body = colsSorted.map(colName => chrNames.map(chrName => s[chrName][colName])),
  // or body.unshift(chrNames)
  table = [chrNames].concat(body),
  rows = Object.entries(s).map(([chrName, chr]) => { chr.Name = chrName; return chr; }),
  /** Name column is prepended in hbs instead of here, so it can be shown without icon. */
  columnNames = colsSorted; // ['Name'].concat();
  dLog(fnName, table);
  return {rows, table, columnNames};
}

export { vcfPipeline };
/** Show the vcf files in columns sorted according to the sequence in which they
 * are constructed, so that the derived files are to the right of the files they
 * are based on.
 * Usage : vcfPipeline.indexOf(suffix)  -1 if suffix is not used in the pipeline
 * @see lb4app/lb3app/scripts/vcfGenotypeLookup.Makefile
 */
const vcfPipeline = [
  "",
  "·csi",
  "·MAF",
  "·MAF·csi",
  "·MAF·SNPList",
  "·MAF·SNPList·csi",
  "·SNPList",
  "·SNPList·csi",
];
export { vcfFileCmp };
function vcfFileCmp(a, b) {
  const
  /* subtract([a,b].map(indexOf)) if both defined, else if one is defined, sort it left,
   * else compare: unicodeDot (which stands in for .) and if that is equal
   * fall back to defaultCmp().
   */
  order = [a, b].map(suffix => { return vcfPipeline.indexOf(suffix); }),
  isPipeline = order.map(o => o >= 0),
  cmp = (isPipeline[0] && isPipeline[1]) ?
    (order[0] - order[1]) :
    isPipeline[0] || isPipeline[1] ? isPipeline[1] - isPipeline[0] :
    repeatsCmp(a, b) ||
    defaultCmp(order[0], order[1]);
  return cmp;
}
/** Count occurences of unicodeDot '·',
 * which is what '.' is mapped to (to avoid being interpreted as a sub-field).
 */
function repeatsCmp(a, b) { return stringCountString(a, unicodeDot) - stringCountString(b, unicodeDot); }

//------------------------------------------------------------------------------
