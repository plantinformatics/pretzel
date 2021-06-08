/* global require */

/* global exports */

/*----------------------------------------------------------------------------*/

/*
 * Blast Output Columns :
query ID, subject ID, % identity, length of HSP (hit), # mismatches, # gaps, query start, query end, subject start, subject end, e-value, score, query length, subject length
 * column names :
  0 name
  1	chr
  2	pcIdentity
  3	lengthOfHspHit
  4	numMismatches
  5	numGaps
  6	queryStart
  7	queryEnd
  8	pos
  9	end
 10	eValue
 11	score
 12	queryLength
 13	subjectLength
*/

/** Identify the columns of blast output result
 */
const
c_name = 0, c_chr = 1, c_pcIdentity = 2, c_lengthOfHspHit = 3, 
c_pos = 8, c_end = 9,
c_queryLength = 12;


/** Filter Blast Search output results.
 *
 * coverage = length of HSP/query length  *100
 */
exports.filterBlastResults = (
  minLengthOfHit, minPercentIdentity, minPercentCoverage, line) => {
    let ok,
        cols = line.split('\t');
    if (cols && cols.length > c_end) {
      ok = (+cols[c_pcIdentity] >= +minPercentIdentity) &&
        (+cols[c_lengthOfHspHit] >= +minLengthOfHit) && 
        (+cols[c_queryLength] && (100 * +cols[c_lengthOfHspHit] / +cols[c_queryLength] >= +minPercentCoverage));
    }
    console.log('filterBlastResults', ok, minLengthOfHit, minPercentIdentity, minPercentCoverage, line, cols);
  return ok;
};



         
