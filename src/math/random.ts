import nmath from './native';
import { strShuffle } from '../@internals/util';
import { Exception } from '../@internals/errors';


export class Random {
  #value: number;
  #scale: number;

  public constructor() {
    this.#value = nmath.random();
    this.#scale = 1;
  }

  /**
   * Get a random number between 0 and 1.
   */
  public static get random(): number {
    return nmath.random();
  }

  /**
   * Get a random integer number between `start` and `end`.
   * 
   * @param {number} start 
   * @param {number} end 
   * @param {string} round 
   * @returns {number}
   */
  public static integer(start: number, end?: number): number {
    return Random.uniform(start, end, 'round');
  }

  /**
   * Get a random number between `start` and `end`.
   * 
   * @param {number} start 
   * @param {number} end 
   * @param {string} round 
   * @returns {number}
   */
  public static uniform(start: number, end?: number, round?: 'ceil' | 'floor' | 'round'): number {
    if (!end) {
      end = start;
      start = 0;
    }

    const random = nmath.random() * (end - start) + start;

    if (!round || !['ceil', 'floor', 'round'].includes(round)) return random;
    return nmath[round](random);
  }

  /**
   * Return a random string of the specified length with or without expecial characters.
   * 
   * @param {number} length 
   * @param {boolean} useSpecialChars 
   * @returns 
   */
  public static string(length: number, useSpecialChars: boolean = true): string {
    const keys: string = strShuffle(`abcdefghijklmnopqrstuvwxyz${'abcdefghijklmnopqrstuvwxyz'.toUpperCase()}0987654321${useSpecialChars ? '@#-_)([];:%*' : ''}`);
    let result: string = '';

    for (let i = 0; i < length; i++) {
      const offset = nmath.floor(nmath.random() * keys.length);
      result += keys.substring(offset, offset + 1);
    }

    return result;
  }

  /**
   * Return a random element from the provided array.
   * 
   * @param {any[]} arr 
   * @returns {any}
   */
  public static choose<T>(arr: ReadonlyArray<T>): T {
    const i = nmath.floor(nmath.random() * arr.length);
    return arr[i];
  }

  /**
   * Randomly permute a sequence, or return a permuted range.
   * 
   * If x is a multi-dimensional array, it is only shuffled along its first index keeping the sub-arrays in the same order.
   * 
   * If x is an array, make a copy and shuffle the elements randomly
   * 
   * If x is an integer, randomly permute.
   * 
   * @param x 
   * @returns 
   */
  public static permutation<T>(x: number | [T[], number]): T[] {
    let arr: T[];
    let size: number;

    if (Array.isArray(x)) {
      [arr, size] = x;
    } else {
      arr = (Array.from({ length: x }, (_, i) => i) as unknown as any);
      size = x;
    }

    for (let i = arr.length - 1; i > 0; i--) {
      const j = nmath.floor(nmath.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    return arr.slice(0, size);
  }

  /**
   * Return the random number between 0 and 1 generated when the class was instantiated.
   */
  public get static(): number {
    return this.#value;
  }

  /**
   * Return a random number between 0 and 1 multiplied by the scale value.
   */
  public get random() {
    return nmath.random() * this.#scale;
  }

  /**
   * Set the scale value.
   * 
   * @param value 
   * @returns 
   */
  public scale(value: number): this {
    this.#scale = value;
    return this;
  }

  /**
   * Return the next random integer between 0 and n.
   * 
   * @param n 
   * @returns 
   */
  public nextInt(n: number | unknown[]): number {
    let result: number = -1;

    if (Array.isArray(n)) {
      if (n.length < 1) {
        throw new Exception('The provided array must contain at least one element.', 'ERR_INVALID_ARGUMENT');
      }

      result = nmath.floor(nmath.random() * n.length);
    } else {
      if (!Number.isFinite(n)) {
        throw new Exception('The provided value must be a finite number.', 'ERR_INVALID_ARGUMENT');
      }

      result = nmath.floor(this.random * (n + 1));
    }

    return result;
  }
}


/**
 * Randomly permute a sequence, or return a permuted range.
 * 
 * If x is a multi-dimensional array, it is only shuffled along its first index keeping the sub-arrays in the same order.
 * 
 * If x is an array, make a copy and shuffle the elements randomly
 * 
 * If x is an integer, randomly permute.
 * 
 * @param x 
 * @returns 
 */
export function permutation<T>(x: number | [T[], number]): T[] {
  let arr: T[];
  let size: number;

  if(Array.isArray(x)) {
    [arr, size] = x;
  } else {
    arr = (Array.from({ length: x }, (_, i) => i) as unknown as any);
    size = x;
  }

  for(let i = arr.length - 1; i > 0; i--) {
    const j = nmath.floor(nmath.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr.slice(0, size);
}


export default Random;
