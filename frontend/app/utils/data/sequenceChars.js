/** 
 * using table from :
 * https://blast.ncbi.nlm.nih.gov/Blast.cgi?CMD=Web&PAGE_TYPE=BlastDocs&DOC_TYPE=BlastHelp
  (replace-regexp "    +" "\n")
  (replace-string "/" "")
  (replace-regexp "^\\(.\\)  \\(.+\\) (\\(.+\\))" "\\2 : '\\1',\t// \\3")
  (replace-regexp "^\\(.\\)  \\(.+\\)" "\\2 : '\\1',")
*/

const ambiguityCodesMap = {
  ACGT : 'N',	// any
  GT : 'K',	// keto
  CG : 'S',	// strong
  CT : 'Y',	// pyrimidine 
  AC : 'M',	// amino
  AT : 'W',	// weak
  AG : 'R',	// purine
  CGT : 'B',
  AGT : 'D',
  ACT : 'H',
  ACG : 'V',
  '-' : '-',
};

const validSequenceChars = 'ACGTUMRWSYKVHDBN';
/** place '-' first so this can be used in []. */
const validBaseChars = '-ACGT';

/*----------------------------------------------------------------------------*/

/** Pre-requisite : this string has satisfied isValidAlternateBasesOrAmbiguityCodes().
 * i.e. there are only single bases between /, no multi-base sequence.
 * If ab contains '-', return '-';  this might be a way to handle multi-base sequences.
 */
function alternateBasesToAmbiguityCode(ab) {
  let s = new Set();
  let dash;
  for (let i = 0; i < ab.length; i++) {
    var ai = ab[i];
    if (ai === '-') {
      dash = true;
    }
    else if ((ai !== '/') && (ai !== '[') && (ai !== ']')) {
      s.add(ai);
    }
  }
  const
  sj = dash ? '-' : Array.from(s.values()).sort().join(''),
  ac = ambiguityCodesMap[sj];
  return ac;
}

function alternateBasesToAmbiguityCodes(seq) {
  const
  r = new RegExp('\\[[' + validBaseChars +  '/]+\\]', 'ig'),
  ac = seq.replaceAll(r, (a) => alternateBasesToAmbiguityCode(a));
  return ac;
}

function isValidAlternateBasesOrAmbiguityCodes(sequence) {
  const
  validREString = '^' +
    '(?:' +
    '[' + validSequenceChars + ']*' + '|' +
    '\\[' + '[' + validBaseChars + ']' +
      '(?:' + '/' + '[' + validBaseChars  + ']' + ')*' +
    '\\]' +
    ')*' +
    '$',
  r = new RegExp(validREString, 'ig'),
  ok = r.test(sequence);

  return ok;
}

/*----------------------------------------------------------------------------*/


export { ambiguityCodesMap, alternateBasesToAmbiguityCodes, isValidAlternateBasesOrAmbiguityCodes };
