import Annotation from './manage-block-annotation';

export default Annotation.extend({
  actions: {
    selectInterval(interval) {
      this.sendAction('selectInterval', chr);
    },
    deleteInterval(interval) {
      console.log('DELETE INTERVAL')
      // console.log(this.interval)
      console.log(interval)
      console.log(interval.id)

      interval.deleteRecord()
      console.log('DELETED RECORD')
      interval.save()
      console.log('SAVE RECORD')


      // this.sendAction('deleteInterval', interval.id);
    },
    switchGeneticmap(geneticmap) {
      console.log('switchGeneticmap')
      let active = this.get('layout.active')
      this.set('layout.active', !active)
    }
  }
});
