import EntryBase from './entry-base';

/*----------------------------------------------------------------------------*/

const dLog = console.debug;

/*----------------------------------------------------------------------------*/

export default EntryBase.extend({


  /*--------------------------------------------------------------------------*/
  actions : {
    loadBlock(block) {
      this.sendAction('loadBlock', block);
    }
  }, // actions
  /*--------------------------------------------------------------------------*/

  featureHasAliases(featureName) {
    /** array of aliases which mapped to this feature name. */
    let
    aliases = this.featuresAliases[featureName],
    /** return the other half of the alias, relative to featureName.  */
    aliasNames = aliases; /*&& aliases
      .map((a) => (a.string1 === featureName) ? a.string2 : a.string1); */
    dLog('featureHasAliases', aliases, featureName /*, aliasNames*/);
    return aliasNames;
  },


});
