import { Pair } from './pair';
import { ReadonlyMap } from './map';


export interface Frequency<T> {
  readonly objectsCount: number;
  readonly pairs: readonly Pair<T, number>[];
  readonly map: ReadonlyMap<T, Pair<T, number>>;
}

export function termFrequency<T>(arr: T[]): Frequency<T> {
  const frequencies = new Map<T, Pair<T, number>>();

  for(let i = 0; i < arr.length; i++) {
    const freq = frequencies.get(arr[i])?.second || 0;
    frequencies.set(arr[i], new Pair(arr[i], freq + 1));
  }

  return Object.freeze({
    objectsCount: frequencies.size,
    map: new ReadonlyMap(frequencies),
    pairs: Object.freeze(Array.from(frequencies.values())),
  });
}


export function round(value: number, base = 1): number {
  if(Math.abs(base) >= 1) return Math.round(value / base) * base;
  
  // Sometimes when a number is multiplied by a small number, precision is lost,
  // for example 1234 * 0.0001 === 0.12340000000000001, and it's more precise divide: 1234 / (1 / 0.0001) === 0.1234.
  const counterBase = 1 / base;
  return Math.round(value * counterBase) / counterBase;
}
