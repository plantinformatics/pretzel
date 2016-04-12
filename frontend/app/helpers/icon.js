import Ember from 'ember';

export function icon(params, hash={}) {
  const color = hash.color || undefined;
  const size = hash.size || undefined;
  const disabled = hash.disabled ? "disabled" : undefined;
  const loading = hash.loading ? "loading" : undefined;
  const fitted = hash.fitted ? "fitted" : undefined;
  const inverted = hash.inverted ? "inverted" : undefined;
  const circular = hash.circular ? "circular" : undefined;
  const bordered = hash.bordered ? "bordered" : undefined;
  const rotated = hash.rotated ? "rotated" : undefined;
  const flipped = hash.flipped ? "flipped" : undefined;
  const classes = [size, color, loading, disabled, fitted, inverted, circular, bordered, rotated, flipped].compact().join(' ');

  return Ember.String.htmlSafe(`<i class='${classes} ${params[0]} icon'></i>`);
}

export default Ember.Helper.helper(icon);
