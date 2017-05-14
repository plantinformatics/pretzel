import Ember from 'ember';

export function scaffoldMarkers(params) {
  let
  scaffolds = params[0],
  /** creating array in loop;  move this outside the each loop, or otherwise access scaffold from each */
  scaffoldArray = Array.from(scaffolds),
  index  = params[1],
  scaffoldMarkers = params[2],
  scaffoldName = scaffoldArray[index],
  markers = scaffoldMarkers[scaffoldName];
  // console.log("getScaffoldMarkers in selected-markers controller", params, scaffolds, scaffoldArray, index, scaffoldMarkers, scaffoldName, markers);
  return markers;
}

export default Ember.Helper.helper(scaffoldMarkers);
