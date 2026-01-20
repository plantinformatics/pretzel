import Component from '@glimmer/component';
import { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import { later } from '@ember/runloop';

//----------------------------------------

import zxcvbn from 'zxcvbn';

//----------------------------------------
//------------------------------------------------------------------------------

/** value of result.guesses_log10 which is labelled as 'good';
 * The bar colour changes to green near this point.
 * This is also the threshold which returns 'good' in passwordStrengthText.
 */
const guesses_log10_good = 15;


/**
 * @param passwordChanged action called with (password, good).
 * If the parent component does not require good strength, then it can ignore
 * the 2nd parameter :
 * @passwordChanged={{action (mut this.password)}}
 */
export default class FormPasswordInputComponent extends Component {

  revealPassword = false;
  @computed('revealPassword')
  get passwordInputType() {
    return this.revealPassword ? 'text' : 'password';
  }

  //----------------------------------------------------------------------------

  /** map the input .password to a measure of its complexity
   */
  @computed('password')
  get passwordStrength () {
    let score;
    if (this?.password) {
      score = zxcvbn(this.password);

      const
      log10 = score.guesses_log10,
      good = log10 >= guesses_log10_good,
      goodPassword = (good || ! this.args.requireGood) ? this.password : null;
      /* See guesses_log10_good and passwordStrengthText(). */
      later(() => this.args.passwordChanged(goodPassword));
    }
    return score;
  };

  @alias('passwordStrength.crack_times_display.offline_fast_hashing_1e10_per_second')
  passwordStrengthScore;
  @alias('passwordStrength.guesses_log10') guesses_log10;
  @computed('passwordStrength')
  get passwordStrengthText () {
    const log10 = this.guesses_log10;

    let text;
    if (log10 < 7) { text = 'low'; }
    else if (log10 < guesses_log10_good) { text = 'medium'; }
    else if (log10 < 22) { text = 'good'; }
    else { text = 'very good'; }

    return text;
  }

  //----------------------------------------------------------------------------

}
