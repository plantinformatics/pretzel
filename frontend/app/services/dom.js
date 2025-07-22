import Service from '@ember/service';


const dLog = console.debug;

const modifiers = ['Shift', 'Control', 'Alt'];

/** Provide :
 * .states, which monitors the state of keyboard modifies Shift, Control, Alt.
 */
export default class DomService extends Service {

  states = {}

  receiveEventCb(state) {
    const receiveEvent = (event) => {
      const key = event.key;
      // dLog('receiveEvent', key, state, this.states);
      if (modifiers.includes(key))
        this.states[key] = state;
    };
    return receiveEvent;
  }

  init() {
    super.init(...arguments);

    document.addEventListener('keydown', this.receiveEventCb(true));
    document.addEventListener('keyup', this.receiveEventCb(false));
  }


}
