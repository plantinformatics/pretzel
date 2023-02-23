import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { computed, action, set as Ember_set } from '@ember/object';


import {
  expRangeBase, expRange, expRangeInitial,
} from '../../utils/domElements';

//------------------------------------------------------------------------------

const dLog = console.debug;

const trace = 1;

//------------------------------------------------------------------------------


/** Comprising a input range slider and a text input field,
 * accept inputs from both and convert to the other format.
 * The slider has a logarithmic scale;
 * this gives greater resolution at the value is reduced.
 * The valid range of output values are [valueMin, valueMax].
 *
 * @param @valueMin
 * @param @valueMax
 * @param @allowZero  true indicates 0 may be initial value or entered in text input.
 * @param @valueInitial  initial / default value
 * @param @valueChanged  action called when the value is changed using either
 * slider or text input.
 *
 * valueChanged parameters are (value, inputType) inputType : "text" or "range",
 * Indicating the source of the input was text input or range slider.
 *
 * @param @labelText Text to display beside the text input field.
 *
 * @desc
 * Usage example
 *
const sbSizeThresholdInitial = 20;
const sbSizeThresholdMax = 1e9;

<elem/InputRangeText
  @labelText="Synteny Block Size Threshold"
  @valueInitial={{this.sbSizeThresholdInitial}}
  @valueMin=1
  @valueMax={{this.sbSizeThresholdMax}}
  @valueChanged={{action (fn this.updateSyntenyBlocksPosition)}} >

*/
export default class ElemInputRangeTextComponent extends Component {


  /** .value is the minimum size for synteny blocks / trapezoids to be displayed.
   * The user has 2 controls for changing .value : text input and a range slider.
   * This component has an attribute .value and change action functions : value{Text,Linear}{,Changed}
   * The change functions set .value and the other attribute value
   * (i.e. valueTextChanged() sets .valueLinear, and vice versa)
   * and call @valueChanged().
   */

  @tracked
  valueLinear;
  @tracked
  valueText;
  @tracked
  value;

  /** The initial / default value is set in these 3 fields, in their respective formats.
   */
  constructor() {
    super(...arguments);
    this.nSteps = 50;
    this.value = this.args.valueInitial;
    this.rangeMax = this.args.valueMax / this.args.valueMin;
    /** when converting from slider / linear to text, truncate at this number of digits. */
    this.digits = Math.log10(this.rangeMax);
    /** ratio of value change of 1 step. i.e. value in exponential range of 1 step in linear range. */
    this.base = expRangeBase(this.nSteps, this.rangeMax);
    this.valueLinear = this.toLinear(this.args.valueInitial);
    this.valueText = "" + this.args.valueInitial;
  }

  toLinear(value) {
    /** 0 is not valid in the exponential range, but e.g. manage-genotype MAF
     * Threshold uses it to indicate no filter, so return the minimum linear
     * value : 0
     * See @allowZero
     */
    const linear = value ? expRangeInitial(value / this.args.valueMin, this.base) : 0;
    return linear;
  }

  @action
  valueTextChanged(value) {
    /* {{input value=valueText ... }} sets
     * this.valueText, and (action ...  value=target.value)
     * passes the same value to this function.
     * this.valueText is already set by value=this.valueText in hbs
     */
    if ( /*(this.valueText !== value) && */ trace) {
      dLog('valueTextChanged', this.valueText, value);
    }
    /** value is a string. */
    value = +value;
    if ((value === 0) &&  this.args.allowZero) {
      /* OK */
    } else if ((value < this.args.valueMin) || (value > this.args.valueMax)) {
      /* Could clamp the value (and would have to set .valueText to
       * the clamped value, but probably better to not accept the input, and let
       * the user fix it.
       *   value = Math_clamp(value, this.args.valueMin, this.args.valueMax);
       */
      return;
    }
    if (value !== this.value) {
      let linear = this.toLinear(value);
      if (trace) {
        dLog('valueTextChanged', this.valueText, value, linear);
      }
      /* setting this.valueLinear updates the range slider because of value= :
       * <input value={{valueLinear}} ...
       */
      Ember_set(this, 'valueLinear', linear);
      this.setValue(value, 'text');
    }
  }

  /**
   * @param value
   * @param inputType "text" or "range"
   * Indicating the source of the input was text input or range slider.
   */
  setValue(value, inputType) {
    this.value = value;
    this.args.valueChanged(value, inputType);
  }

  @action
  valueLinearChanged(linear) {
    /**
     * (comment from updateSbSizeThresh() )
     * Size is normally measured in base pairs so round to integer;
     * move this to caller's valueChanged() : Math.round(value)
     * this may be OK for centiMorgans also; genetic map markers
     * have a single position not a range so 'size' will be 0, and
     * synteny-block representation (trapezoid) would only be used
     * if aligning GM to physical.
     *
     * <input range {{action ... value="target.value"}} >
     * gives the param linear a string value.
     */
    let value = this.args.valueMin * expRange(+linear, this.nSteps, this.rangeMax);
    value = digitsRound(value, this.digits);
    // dLog('valueLinearChanged', linear, value);
    /* setting this.valueText updates the text input because of :
     * {{input ... value=valueText
     * The range slider does not change this.valueLinear
     */
    this.valueText = "" + value;    
    this.setValue(value, 'range');
  }

}

/** Truncate number x to the given number of digits.
 * 
 * related :
 *   draw/axis.js : axisConfig() digits, formatString
 *   draw/interval-bins.js : binEvenLengthRound()
 */
function digitsRound(x, digits) {
  const
  xs = '' + x,
  /* approximate, without log() :  if (xs.startsWidth('0.')) { digits += 2; }
   */
  decPlaces = -Math.log10(x);
  if (decPlaces > 0) { digits += 2 + decPlaces; }
  const trunc = xs.slice(0, digits);
  return +trunc;
}

