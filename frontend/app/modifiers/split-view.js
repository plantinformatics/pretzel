import { setModifierManager, capabilities } from '@ember/modifier';
import EmberObject from '@ember/object';
import { assign } from '@ember/polyfills';
import Split from 'split.js';

export function createSplit(el, args) {
  let { children } = el;

  if (children.length > 1) {
    let isVertical = args.direction === 'vertical';
    el.style.display = 'flex';
    el.style['flex-direction'] = isVertical ? 'column': 'row';

    return Split(children, assign({}, {
      gutterSize: 7,
      elementStyle(dimension, size, gutterSize) {
        let amount = `calc(${size}% - ${gutterSize}px)`;
        let props = {
          'flex-basis': amount,
          [isVertical ? 'max-height' : 'max-width']: amount
        };

        return props;
      },
      gutterStyle(dimension, gutterSize) {
        return {
          'flex-basis': `${gutterSize}px`
        }
      }
    }, args))
  }

  return null;
}


class SplitModifierManager {
  constructor(owner) {
    this.owner = owner;
    /* updated from 3.13 */
    this.capabilities = capabilities('3.22');
  }

  createModifier(Definition, args) {
    /** changed for 3.22, as indicated in :
     * https://deprecations.emberjs.com/v3.x/#toc_manager-capabilities-modifiers-3-13
     */
    return new Definition(args);
  }

  installModifier(instance, element, args) {
    let { positional, named } = args;
    instance.element = element;
    instance.didInsertElement(element, positional, named);
  }

  updateModifier(instance, args) {
    let { positional, named } = args;
    instance.didUpdate(instance.element, positional, named);
  }


  destroyModifier(instance) {
    instance.willDestroyElement();
  }
}

class SplitViewModifier extends EmberObject {
  didInsertElement(el, positional, args) {
    const registerInstance = args.registerInstance;
    if (registerInstance) {
      delete args.registerInstance;
    }
    this.splitInstance = createSplit(el, args);
    console.log(this.splitInstance, registerInstance);
    // window.PretzelFrontend.splitInstance = this.splitInstance;
    if (registerInstance) {
      registerInstance(this.splitInstance);
    }
  }

  didUpdate(el, positional, args) {
    let { rerender } = args;
    if (this.rerender !== rerender) {
      if (this.splitInstance) {
        this.splitInstance.destroy();
        this.splitInstance = null;
      }

      this.splitInstance = createSplit(el, args);
      this.rerender = rerender;
    }
  }

  willDestroyElement() {
    if (this.splitInstance) {
      this.splitInstance.destroy();
      this.splitInstance = null;
    }
  }
}

export default setModifierManager(
  (owner) => new SplitModifierManager(owner), SplitViewModifier
);
