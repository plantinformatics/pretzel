import { helper } from '@ember/component/helper';

/** @return <number>[] with numbers rounded to 0 or 2 digits
 * @param  params positional (array) parameters : [domain, decimals]
 * domain : <number>[]  or undefined
 * decimals : number of decimal places to display
 * Usually 0 for reference assembly e.g. VCF / Genotype / Genes / Alignment
 * and 2 for Genetic Map.
 */
export default helper(function domainRounded(params/*, hash*/) {
  const [domain, decimals] = params;
  /** based on brushedDomainRounded() from components/panel/manage-genotype.js
   */
  const rounded = domain?.map((d) => d.toFixed(decimals));

  return rounded;
});
