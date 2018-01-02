import Annotation from './manage-block-annotation';

export default Annotation.extend({
  actions: {
    switchGeneticmap(geneticmap) {
      console.log('switchGeneticmap')
      let active = this.get('layout.active')
      this.set('layout.active', !active)
    }
  }
});
