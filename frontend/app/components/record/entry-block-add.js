import { computed } from '@ember/object';

/*----------------------------------------------------------------------------*/

import EntryBase from './entry-base';

/*----------------------------------------------------------------------------*/

const dLog = console.debug;

/*----------------------------------------------------------------------------*/

export default EntryBase.extend({


  /*--------------------------------------------------------------------------*/
  actions : {
    loadBlock(block) {
      this.loadBlock(block.content);
    }
  }, // actions
  /*--------------------------------------------------------------------------*/

  
  clicked : false,
  toggleClicked() {
    this.toggleProperty('clicked');
    /** click off forces close, regardless of hover. */
    if (! this.clicked) {
      this.set('hovered', false);
    }
  },
  hovered : false,
  enter() {
    this.set('hovered', true);
  },
  leave() {
    this.set('hovered', false);
  },
  showToggleablePopover : computed('clicked', 'hovered', function () {
    return this.clicked || this.hovered;
  }),


  featureHasAliases(featureName) {
    /** array of aliases which mapped to this feature name. */
    let
    aliases = this.featuresAliases ? this.featuresAliases[featureName] : [],
    /** return the other half of the alias, relative to featureName.  */
    aliasNames = aliases; /*&& aliases
      .map((a) => (a.string1 === featureName) ? a.string2 : a.string1); */
    dLog('featureHasAliases', aliases, featureName /*, aliasNames*/);
    return aliasNames;
  },



});
