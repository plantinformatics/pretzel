import Component from '@glimmer/component';
import { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import { later } from '@ember/runloop';

//----------------------------------------

import zxcvbn from 'zxcvbn';

//----------------------------------------
//------------------------------------------------------------------------------

/** value of result.guesses_log10 which is labelled as 'good';
 * The bar colour changes to green near this point (commented in passwordStrengthText).
 * This is also the threshold which returns 'good' in passwordStrengthText.
 */
const guesses_log10_good = 10;


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
   * @return the result of zxcvbn(), of which only .guesses_log10 is used.
   * guesses_log10 is roughly the number of chars in the password if the
   * characters are fairly random.
   *
   * Example value of the result of zxcvbn() : Object { password: "...",
   * guesses: 152880, guesses_log10: 5.18.., sequence: (2) [...], calc_time:
   * 117376, crack_times_seconds: {...}, crack_times_display: {...}, score: 1,
   * feedback: {...} }
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

  /** This was initially displayed, but replaced by .passwordStrengthText for
   * text, and by .guesses_log10 in ValueMeter.  */
  @alias('passwordStrength.crack_times_display.offline_fast_hashing_1e10_per_second')
  passwordStrengthScore;
  @alias('passwordStrength.guesses_log10') guesses_log10;
  @computed('passwordStrength')
  get passwordStrengthText () {
    const log10 = this.guesses_log10;
    /** passing @max=17 to ValueMeter in password-input.hbs places the red/green
     * threshold, at which the colour bar becomes recognisably green, at 10
     * (i.e. guesses_log10_good).
     */
    let text;
    if (log10 < 5) { text = 'low'; }
    else if (log10 < guesses_log10_good) { text = 'medium'; }
    else if (log10 < 15) { text = 'good'; }
    else { text = 'very good'; }

    return text;
  }

  @computed('passwordStrength')
  get passwordStrengthMessage () {
    const
    log10 = this.guesses_log10,
    ok = log10 >= guesses_log10_good,
    text = ok ? null : "A stronger password is required.";

    return text;
  }


  //----------------------------------------------------------------------------

}
