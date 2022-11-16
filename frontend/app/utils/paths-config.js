
/** When working with aliases: only show unique connections between features of adjacent Axes.
 * Features are unique within Axes, so this is always the case when there are no aliases.
 * Counting the connections (paths) between features based on aliases + direct connections,
 * if there is only 1 connection between a pair of features, i.e. the mapping between the Axes is 1:1,
 * then show the connection.
 *
 * Any truthy value of unique_1_1_mapping enables the above; special cases :
 * unique_1_1_mapping === 2 enables a basic form of uniqueness which is possibly not of interest
 * unique_1_1_mapping === 3 enables collateStacksA (asymmetric aliases).
 */
let unique_1_1_mapping = 3;


export {
  unique_1_1_mapping,
}
