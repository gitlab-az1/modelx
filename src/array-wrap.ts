import { Exception } from './@internals/errors';
import type { DT, ObjectKeys } from './@internals/types';
import { Either, left, right } from './@internals/either';
import { assert, isDataType, isThenable } from './@internals/util';


export interface ArrayNode<T> {
  readonly index: number;
  readonly value: T | null;
  readonly next: ArrayNode<T> | null;
}

interface ArrayPointer<T> {
  root: ArrayNode<T>;
  type: ObjectKeys<DT>;
  size_t: number;
}

export type ComparatorFn<T> = (a: T, b: T) => 1 | 0 | -1;


export function array<K extends keyof DT, T extends DT[K] = DT[K]>(size: number, t: K, fill?: (i: number) => T): Either<Exception, ArrayPointer<T>> {
  assert(typeof size === 'number' && Number.isInteger(size) && size >= 0);
  assert(typeof t === 'string' && isDataType(t));

  try {
    return right({
      root: _fillList(0, size, fill || (() => null)),
      type: t,
      size_t: size,
    }) as any;
  } catch (err: any) {
    return left(err);
  }
}

export function findIndex<T>(ptr: ArrayPointer<T>, needle: T, comparator?: ComparatorFn<T>): number {
  if(ptr.root === null) return -1;

  let i = 0;
  let node = ptr.root as ArrayNode<T> | null;

  while(node != null) {
    if(!!node.value && _compare(node.value, needle, comparator) === 0) return i;

    i++;
    node = node.next;
  }

  return -1;
}

export function push<T>(ptr: ArrayPointer<T>, value: T): void {
  let current: ArrayNode<T> = ptr.root;

  while(current.value != null) {
    current = current.next!;
  }

  Object.assign(current, { value });
}


function _fillList<T>(index: number, size: number, fill?: (i: number) => T): ArrayNode<T> | null {
  if(index >= size) return null;
  const value = fill ? fill(index) : null;

  if(isThenable(value)) {
    throw new Exception(`Unexpected promise at 'typeof ${typeof value}' as the result of an array filler function`, 'ERR_UNEXPECTED_PROMISE');
  }

  return {
    index,
    value,
    next: _fillList(index + 1, size, fill),
  };
}

function _compare<T>(a: T, b: T, cfn?: ComparatorFn<T>): 1 | 0 | -1 {
  if(!cfn || typeof cfn !== 'function') return a > b ? 1 : a < b ? -1 : 0;
  const result = cfn(a, b);

  if(isThenable(result)) {
    throw new Exception(`Unexpected promise at 'typeof ${typeof result}' in return of comparator function`, 'ERR_UNEXPECTED_PROMISE');
  }

  if(![1, 0, -1].includes(result)) {
    throw new Exception(`Unexpected 'typeof ${typeof result}': "${String(result)}". Expected 1, 0 or -1`, 'ERR_INVALID_ARGUMENT');
  }

  return result;
}
