import { helper as buildHelper } from '@ember/component/helper';

export function formatDate(date) {
  return date.toLocaleString();
}

export default buildHelper(formatDate);