import { Exception } from './errors';
import type { DT, ObjectKeys } from './types';
import { Either, left, right } from './either';


export function assertString(value: unknown, msg?: string): asserts value is string {
  if(!value || typeof value !== 'string') {
    throw new Exception(msg || `Cannot use 'typeof ${typeof value}' as 'typeof string'`, 'ERR_INVALID_TYPE', {
      actual: value,
      expected: 'typeof string',
    });
  }
}

export function assertNumber(value: unknown, msg?: string): asserts value is number {
  if(!value || typeof value !== 'string') {
    throw new Exception(msg || `Cannot use 'typeof ${typeof value}' as 'typeof number'`, 'ERR_INVALID_TYPE', {
      actual: value,
      expected: 'typeof number',
    });
  }
}

export function assert(condition: boolean | number | (() => number | boolean), msg?: string): asserts condition {
  if(typeof condition === 'function') {
    const result = condition();

    if(isThenable(result)) {
      throw new Exception(`Cannot assert an asynchronous result of 'typeof ${result.toString()}'`, 'ERR_UNEXPECTED_PROMISE');
    }

    switch(typeof result) {
      case 'boolean':
        if(!result) {
          throw new Exception(msg || `Assertation failed for 'typeof ${typeof result}'`, 'ERR_ASSERTATION_FAILED');
        }

        break;
      case 'number': {
        if(result === 0 || result < 0) {
          throw new Exception(msg || `Assertation failed for 'typeof ${typeof result}'`, 'ERR_ASSERTATION_FAILED');
        }

        break;
      }
      default:
        throw new Exception(`Unexpected 'typeof ${typeof result}' as assertation type`, 'ERR_INVALID_TYPE');
    }
  } else if(typeof condition === 'number') {
    if(condition === 0 || condition < 0) {
      throw new Exception(msg || `Assertation failed for 'typeof ${typeof condition}'`, 'ERR_ASSERTATION_FAILED');
    }
  } else if(typeof condition === 'boolean') {
    if(!condition) {
      throw new Exception(msg || `Assertation failed for 'typeof ${typeof condition}'`, 'ERR_ASSERTATION_FAILED');
    }
  } else {
    throw new Exception(`Unexpected 'typeof ${typeof condition}' as assertation type`, 'ERR_INVALID_TYPE');
  }
}


export function isIterableIterator<T>(value: any): value is IterableIterator<T> {
  return typeof value === 'object' && value !== null && typeof value[Symbol.iterator] === 'function' && typeof value.next === 'function';
}

export function isThenable<T>(obj: unknown): obj is Promise<T> {
  return !!obj && typeof obj === 'object' && typeof (<Promise<T>>obj).then === 'function';
}


export const MAX_SAFE_SMALL_INTEGER = 1 << 0x1E;
export const MIN_SAFE_SMALL_INTEGER = -(1 << 0x1E);

/**
 * The maximum value of a 8-bit unsigned integer `2^8 - 1`.
 */
export const MAX_UINT_8 = 0xFF;

/**
 * The maximum value of a 32-bit unsigned integer `2^32 - 1`.
 */
export const MAX_UINT_32 = 0xFFFFFFFF;


export function toUint8(value: number): number {
  if(value < 0) return 0;
  if(value > MAX_UINT_8) return MAX_UINT_8;

  return value | 0;
}

export function toUint32(value: number): number {
  if(value < 0) return 0;
  if(value > MAX_UINT_32) return MAX_UINT_32;

  return value | 0;
}

const kindOf = (cache => (thing: any) => {
  const str = Object.prototype.toString.call(thing);
  return cache[str] || (cache[str] = str.slice(8, -1).toLowerCase());
})(Object.create(null));


export const kindOfTest = (type: string) => {
  type = type.toLowerCase();
  return (thing: any) => kindOf(thing) === type;
};


export function isPlainObject(val: any): boolean {
  if(Array.isArray(val)) return false;
  if(kindOf(val) !== 'object' || typeof val !== 'object') return false;

  const prototype = Object.getPrototypeOf(val);
  return (prototype === null || prototype === Object.prototype || Object.getPrototypeOf(prototype) === null) && !(Symbol.toStringTag in val) && !(Symbol.iterator in val);
}


export function str(input: unknown): Either<Exception, void> {
  try {
    assertString(input);
    return right(void 0);
  } catch (e: any) {
    return left(e);
  }
}


export function isDataType(input: string): input is ObjectKeys<DT> {
  return [
    'string',
    'number',
    'boolean',
    'undefined',
    'function',
    'object',
    'symbol',
    'bigint',
    'list',
  ].includes(input);
}



/**
 * Shuffle the specified string.
 * 
 * @param str 
 * @returns 
 */
export function strShuffle(str: string): string {
  if(typeof str !== 'string' || str.length === 0) return '';

  const arr = str.split('');

  // Loop through the array
  for (let i = arr.length - 1; i > 0; i--) {
    // Generate a random index
    const j = Math.floor(Math.random() * (i + 1));

    // Swap the current element with the random element
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }

  // Convert the array back to a string and return it
  return arr.join('');
}
