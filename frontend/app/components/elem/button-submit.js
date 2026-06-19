import Component from '@ember/component';

/** button-submit was added as a template-only component before Octane;
 * since that release template-only components are by default Glimmer components, not 'Classic' components.
 * https://guides.emberjs.com/v4.7.0/upgrading/current-edition/glimmer-components/#toc_template-only-components
 *
 * The parameter loading is addressed as in a Classic component, so make
 * button-submit a Classic component by adding this file, which uses
 * Component.extend().
 * The definition is empty.
 */
export default Component.extend({


});

