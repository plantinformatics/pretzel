import { helper as buildHelper } from '@ember/component/helper';

export function toJson([obj]) {
  if (!obj) {
    return '';
  }
  return JSON.stringify(obj);
}

export default buildHelper(toJson);