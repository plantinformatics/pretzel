import Component from '@glimmer/component';
import { htmlSafe } from '@ember/template';
import { computed } from '@ember/object';


//------------------------------------------------------------------------------

const dLog = console.debug;

const trace = 0;

//------------------------------------------------------------------------------

const defaultMax = 20;
/** Colours to display when the number at the limits min and max.
 * When the number is within the range [min, max], the hue is calculated
 * proportionate to the position in the range.
 */ 
const hues = {
  min : 0,	// for 0% : red
  max : 120,	// for 100% : green
};

//------------------------------------------------------------------------------

/** Show a number with overlain rectangular bar, coloured red - green
 * for values 0 - 100% of the expected range.
 *
 * Usage example : <ValueMeter @value={{this.score}} @max=25 />
 *
 * @param input value is passed as @value to the component
 * @param max optional - allows caller to override defaultMax
 */
export default class ElemValueMeterComponent extends Component {

  /** Map @value into the range [0, max], expressed as a percentage
   */
  get percentage() {
    const value = this.args.value ?? 0;
    const min = 0;
    const max = this.args.max;
    const
    percentage =
      Math.max(0, Math.min(100, (value - min) / (max - min) * 100));
    return percentage;
  }

  @computed('args.value')
  get meterWidth() {
    // Calculate percentage and constrain between 0 and 100
    const percentage = this.percentage;
    return htmlSafe(`width: ${percentage}%;`);
  }

  @computed('args.value')
  get meterColor() {
    /* Number is displayed relative to 0-100% of [min,max] range,
     * but for this calculation /100 to conver percentage back to ratio.
     */
    const normalized = this.percentage / 100;
    // Calculate hue: red (0) for 0%, green (120) for 100%
    const hue = (hues.max - hues.min) * normalized;
    return htmlSafe(`background-color: hsl(${hue}, 100%, 50%);`);
  }

  /** Combine .meterWidth and .meterColor into a single value,
   * because element can have just 1 style=
   * and this provided style value needs to be a result of htmlSafe().
   * using catenation in .hbs gets this warning:
   *  Binding style attributes may introduce cross-site scripting
   *  vulnerabilities; please ensure that values being bound are properly
   *  escaped. For more information, including how to disable this warning, see
   *  https://deprecations.emberjs.com/v1.x/#toc_binding-style-attributes.
   */
  @computed('meterWidth', 'meterColor')
  get barStyle() {
    return htmlSafe(this.meterWidth + this.meterColor);
  }

  //----------------------------------------------------------------------------

}
