import math from 'next-math';
import { isTypedArray } from 'util/types';

import { Exception } from './errors';


export const PRIMITIVE_BYTE_SIZE = Object.freeze({
  STRING: 0x2,
  BOOLEAN: 0x4,
  BYTES: 0x4,
  NUMBER: 0x8,
  NULL: 0x0,
  INT_8_ARRAY: 0x1,
  UINT_8_ARRAY: 0x1,
  UINT_8_CAMPLED_ARRAY: 0x1,
  INT_16_ARRAY: 0x2,
  UINT_16_ARRAY: 0x2,
  INT_32_ARRAY: 0x4,
  UINT_32_ARRAY: 0x4,
  FLOAT_32_ARRAY: 0x4,
  FLOAT_64_ARRAY: 0x8,
} as const);



function props<T extends object>(obj: T): string[] {
  if(typeof obj !== 'object' || obj === null) return [];

  const p = [] as (string | number | symbol)[];

  for(const prop in obj) {
    p.push(prop);
  }

  if(typeof Object.getOwnPropertySymbols === 'function') {
    Array.prototype.push.apply(p, Object.getOwnPropertySymbols(obj));
  }

  return p.flatMap(String);
}


function _objectSizeof(seen: Set<any> | WeakSet<any>, obj: any): number {
  if(typeof obj !== 'object') {
    throw new Exception(`Cannot calculate sizeof 'typeof ${typeof obj}' in object size calculator`, 'ERR_UNSUPPORTED_OPERATION');
  }

  if(obj === null) return PRIMITIVE_BYTE_SIZE.NULL;
  let bytes: number = 0;

  __non_AssertObject(obj); 
  
  for(const prop of props(obj)) {
    if(typeof obj[prop] === 'object' && obj[prop] !== null) {
      if(!seen.has(obj[prop])) {
        seen.add(obj[prop]);
        bytes += _calculator(seen)(obj);

        try {
          bytes += _calculator(seen)(obj[prop]);
        } catch (e: any) {
          if(e instanceof RangeError) {
            bytes = 0;
          }
        }
      }
    }
  }

  return bytes;
}

function __non_AssertObject(obj: unknown): asserts obj is Record<string, any> { void obj; }

function _typedArraySizeof(obj: any): number {
  if(isTypedArray(obj)) return obj.length * obj.BYTES_PER_ELEMENT;
  return -1;
}

function _calculator(seen: Set<any> | WeakSet<any>): <T = any>(obj: T) => number {
  return (__$__object) => {
    if(typeof Buffer !== 'undefined' && Buffer.isBuffer(__$__object)) return __$__object.byteLength;

    switch(typeof __$__object) {
      case 'string':
        return (
          typeof process !== 'undefined' ?
            12 + 4 * math.ceil(__$__object.length / 4) :
            __$__object.length * PRIMITIVE_BYTE_SIZE.STRING
        );
      case 'boolean':
        return PRIMITIVE_BYTE_SIZE.BOOLEAN;
      case 'number':
        return PRIMITIVE_BYTE_SIZE.NUMBER;
      case 'symbol': {
        const isGlobalSymbol = Symbol.keyFor && Symbol.keyFor(__$__object);

        return isGlobalSymbol
          ? (Symbol.keyFor(__$__object)?.length || 0) * PRIMITIVE_BYTE_SIZE.STRING
          : (__$__object.toString().length - 8) * PRIMITIVE_BYTE_SIZE.STRING;
      }
      case 'object':
        if(Array.isArray(__$__object)) return __$__object.map(_calculator(seen)).reduce((a, c) => a + c, 0);
        return _objectSizeof(seen, __$__object);
      default:
        return 0;
    }
  };
}

function _complexSizeof(obj: any): number | null {
  if(typeof Buffer === 'undefined') return null;

  try {
    let c = obj;

    if(obj instanceof Map) {
      c = Object.fromEntries(obj);
    } else if(obj instanceof Set) {
      c = Array.from(obj);
    }

    if(ArrayBuffer.isView(c)) return _typedArraySizeof(c);

    const s = JSON.stringify(c, (_, value) => {
      if(typeof value === 'bigint' ||
          typeof value === 'function' ||
          typeof value === 'symbol' ||
          (value instanceof RegExp)
      ) return value.toString();

      if(typeof value === 'undefined') return 'undefined';
      return value;
    });

    return Buffer.byteLength(s, 'utf8');
  } catch (err: any) {
    // void err;
    return null;
  }
}

function _simpleSizeof(obj: any): number {
  const list = [] as any[];
  const stack = [obj];
  let bytes = 0;

  while(stack.length > 0) {
    const value = stack.pop();

    if(typeof value === 'boolean') {
      bytes += PRIMITIVE_BYTE_SIZE.BOOLEAN;
    } else if(typeof value === 'string') {
      bytes += (
        typeof process !== 'undefined' ?
          12 + 4 * math.ceil(obj.length / 4) :
          value.length * PRIMITIVE_BYTE_SIZE.STRING
      );
    } else if(typeof value === 'number') {
      bytes += PRIMITIVE_BYTE_SIZE.NUMBER;
    } else if(typeof value === 'symbol') {
      const isGlobalSymbol = Symbol.keyFor && Symbol.keyFor(obj);

      if(isGlobalSymbol) {
        bytes += (Symbol.keyFor(obj)?.length || 0) * PRIMITIVE_BYTE_SIZE.STRING;
      } else {
        bytes += (obj.toString().length - 8) * PRIMITIVE_BYTE_SIZE.STRING;
      }
    } else if(typeof value === 'bigint') {
      bytes += Buffer.from(value.toString()).byteLength;
    } else if(typeof value === 'function') {
      bytes += value.toString().length;
    } else if(typeof value === 'object' && list.indexOf(value) === -1) {
      list.push(value);

      for(const i in value) {
        stack.push(value[i]);
      }
    }
  }

  return bytes;
}




export function sizeof(x: any): number {
  let size = 0;

  if(typeof x === 'object' && x !== null) {
    size = _complexSizeof(x) ?? _calculator(new WeakSet())(x);
  } else {
    size = _simpleSizeof(x);
  }

  return size;
}

export default sizeof;
