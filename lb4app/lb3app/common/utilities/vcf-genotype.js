
/* global exports */
/* global require */

//------------------------------------------------------------------------------

const { childProcess, dataOutReplyClosure, dataOutReplyClosureLimit } = require('../utilities/child-process');

//------------------------------------------------------------------------------


/**
 * @param parent  name of parent or view dataset, or vcf directory name
 * @param scope e.g. '1A'; identifies the vcf file, i.e. datasetId/scope.vcf.gz
 * @param nLines if defined, limit the output to nLines.
 * @param preArgs args to be inserted in command line, additional to the parent / vcf file name.
 * See comment in frontend/app/services/auth.js : vcfGenotypeLookup()
 */
function vcfGenotypeLookup(parent, scope, preArgs, nLines, cb) {
  const
  fnName = 'vcfGenotypeLookup',
  command = preArgs.requestFormat ? 'query' : 'view';
  let moreParams = [command, parent, scope, '-r', preArgs.region ];
  if (preArgs.requestFormat) {
    const
    /** from BCFTOOLS(1) :
     *        %GT             Genotype (e.g. 0/1)
     *        %TGT            Translated genotype (e.g. C/A)
     */
    formatGT = (preArgs.requestFormat === 'CATG') ? '%TGT' : '%GT',
    format = '%ID\t%POS' + '\t%REF\t%ALT' + '[\t' + formatGT + ']\n';
    moreParams = moreParams.concat('-H', '-f', format);
  }
  if (preArgs.samples?.length) {
    moreParams = moreParams.concat('-s', preArgs.samples.replaceAll('\n', ','));
  } else {
    // There is not an option for 0 samples, except via using an empty file :
    moreParams = moreParams.concat('-S', '/dev/null');
  }
  console.log(fnName, parent, preArgs, moreParams);

  childProcess(
    'vcfGenotypeLookup.bash',
    /* postData */ '', 
    /* useFile */ false,
    /* fileName */ undefined,
    moreParams,
    dataOutReplyClosureLimit(cb, nLines), cb, /*progressive*/ true);

};
exports.vcfGenotypeLookup = vcfGenotypeLookup;

//------------------------------------------------------------------------------

