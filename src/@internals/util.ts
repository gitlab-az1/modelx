import { Exception } from './errors';
import { setLastError } from '../environment';
import type { DT, ObjectKeys } from './types';
import { Either, left, right } from './either';



export const ASCI_RED = '\x1b[31m';
export const ASCI_BOLD = '\x1b[1m';
export const ASCI_BLUE = '\x1b[34m';
export const ASCI_CYAN = '\x1b[36m';
export const ASCI_RESET = '\x1b[0m';
export const ASCI_GREEN = '\x1b[32m';
export const ASCI_YELLOW = '\x1b[33m';
export const ASCI_MAGENTA = '\x1b[35m';
export const ASCI_BRIGHT_RED = '\x1b[91m';
export const ASCI_BRIGHT_BLUE = '\x1b[94m';
export const ASCI_BRIGHT_CYAN = '\x1b[96m';
export const ASCI_BRIGHT_GREEN = '\x1b[92m';
export const ASCI_BRIGHT_YELLOW = '\x1b[93m';
export const ASCI_UNDERLINE = '\x1b[4m';


export function assertString(value: unknown, msg?: string): asserts value is string {
  if(typeof value !== 'string' || value.length === 0) {
    throw setLastError(new Exception(msg || `Cannot use 'typeof ${typeof value}' as 'typeof string'`, 'ERR_INVALID_TYPE', {
      actual: value,
      expected: 'typeof string',
    }));
  }
}

export function assertNumber(value: unknown, msg?: string): asserts value is number {
  if(!value || typeof value !== 'string') {
    throw setLastError(new Exception(msg || `Cannot use 'typeof ${typeof value}' as 'typeof number'`, 'ERR_INVALID_TYPE', {
      actual: value,
      expected: 'typeof number',
    }));
  }
}

export function assertArray<T>(value: unknown, msg?: string): asserts value is T[] {
  if(!Array.isArray(value)) {
    throw setLastError(new Exception(msg || `Cannot use 'typeof ${typeof value}' as 'typeof unknown[]'`, 'ERR_INVALID_TYPE', {
      actual: value,
      expected: 'typeof number',
    }));
  }
}

export function assert(condition: boolean | number | (() => number | boolean), msg?: string): asserts condition {
  try {
    if(typeof condition === 'function') {
      const result = condition();
  
      if(isThenable(result)) {
        throw setLastError(new Exception(`Cannot assert an asynchronous result of 'typeof ${result.toString()}'`, 'ERR_UNEXPECTED_PROMISE'));
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
  } catch (err: any) {
    throw setLastError(err);
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


export function doHash(obj: any, hashVal: number = 0): number {
  switch(typeof obj) {
    case 'object':
      if(obj === null) return numberHash(349, hashVal);
      if(Array.isArray(obj)) return arrayHash(obj, hashVal);

      return objectHash(obj, hashVal);
    case 'string':
      return stringHash(obj, hashVal);
    case 'boolean':
      return booleanHash(obj, hashVal);
    case 'number':
      return numberHash(obj, hashVal);
    case 'undefined':
      return numberHash(937, hashVal);
    default:
      return numberHash(617, hashVal);
  }
}

export function numberHash(val: number, initialHashVal: number): number {
  return (((initialHashVal << 5) - initialHashVal) + val) | 0;  // hashVal * 31 + ch, keep as int32
}

function booleanHash(b: boolean, initialHashVal: number): number {
  return numberHash(b ? 433 : 863, initialHashVal);
}

export function stringHash(s: string, hashVal: number) {
  hashVal = numberHash(149417, hashVal);

  for(let i = 0, length = s.length; i < length; i++) {
    hashVal = numberHash(s.charCodeAt(i), hashVal);
  }

  return hashVal;
}

function arrayHash(arr: any[], initialHashVal: number): number {
  initialHashVal = numberHash(104579, initialHashVal);
  return arr.reduce((hashVal, item) => doHash(item, hashVal), initialHashVal);
}

function objectHash(obj: any, initialHashVal: number): number {
  initialHashVal = numberHash(181387, initialHashVal);

  return Object.keys(obj).sort().reduce((hashVal, key) => {
    hashVal = stringHash(key, hashVal);
    return doHash(obj[key], hashVal);
  }, initialHashVal);
}
