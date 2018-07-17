/*----------------------------------------------------------------------------*/
const name_chromosome_block = 'block';	// was chromosome
const name_position_range = "range";  // was position

/*----------------------------------------------------------------------------*/

/** fields added to the chromosome / block object, which are not markers / features.
 * The data structure will be refactored to separate these fields from the features.
  */
const isOtherField = {
  "name" : true,
  "range" : true,
  "scope" : true,
  "featureType" : true,
  "dataset" : true,
  "namespace" : true
};
/*----------------------------------------------------------------------------*/

export { name_chromosome_block, name_position_range, isOtherField };
