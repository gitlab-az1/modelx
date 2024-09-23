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
