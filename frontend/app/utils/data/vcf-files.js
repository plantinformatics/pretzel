import { stringCountString } from '../../utils/string';

//------------------------------------------------------------------------------

const dLog = console.debug;

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
      const
      [whole, sizeTime, chrName, suffix, csi] = m,
      colName = (suffix + csi).replaceAll('.', '_'),
      // s[m[2]][m[3]] = m[1]
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
  // map = new Map([[cols[0],1]])
  colSort = function(a, b) { return stringCountString(a, '.') - stringCountString(b, '.'); },
  colsSorted = cols.sort(colSort),
  chrNames = Object.keys(s),
  body = colsSorted.map(colName => chrNames.map(chrName => s[chrName][colName])),
  // or body.unshift(chrNames)
  table = [chrNames].concat(body),
  rows = Object.entries(s).map(([chrName, chr]) => { chr.Name = chrName; return chr; }),
  columnNames = ['Name'].concat(colsSorted);
  dLog(fnName, table);
  return {rows, table, columnNames};
}

//------------------------------------------------------------------------------
