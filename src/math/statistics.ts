import { sqrt, round } from './native';
import { assert } from '../@internals/util';


/**
 * k = √n
 * 
 * @param {number} n 
 * @returns {number} k 
 */
export function descriptiveClass(n: number): number {
  assert(typeof n === 'number' && Number.isInteger(n) && n >= 0);
  if(n === 0) return 0;

  n = sqrt(n);
  return Number.isInteger(n) ? n : round(n);
}
