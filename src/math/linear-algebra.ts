import native from './native';
import { assert } from '../@internals/util';


export function abs(input: number): number;
export function abs(input: number[]): number[];
export function abs(input: number[][]): number[][];
export function abs(input: number | number[] | number[][]): number | number[] | number[][] {
  assert(typeof input === 'number' || (
    Array.isArray(input) &&
    input.every(x => typeof x === 'number' || (
      Array.isArray(x) &&
      x.every(i => typeof i === 'number')
    ))
  ));

  if(typeof input === 'number') return native.abs(input);
  if(typeof input[0] === 'number') return (<number[]>input).map(native.abs);
  return (<number[][]>input).map(arr => arr.map(native.abs));
}
