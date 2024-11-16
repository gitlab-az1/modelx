import type { MaybePromise } from './types';


export interface AbstractLazyQueue<T extends NonNullable<unknown>> {
  maxLength(): MaybePromise<number>;
  full(): MaybePromise<boolean>;
  empty(): MaybePromise<boolean>;
  length(): MaybePromise<number>;
  enqueue(value: T): MaybePromise<void>;
  dequeue(): MaybePromise<T | null>;
}


export interface AbstractQueue<T extends NonNullable<unknown>, C extends object = any, R = unknown> {
  length(): MaybePromise<number>;
  add(value: T): MaybePromise<void>;
  // eslint-disable-next-line @typescript-eslint/ban-types
  process(worker: (context: (C extends unknown[] ? {} : C) & { readonly job: T; readonly _queue: AbstractQueue<T, C, R> } ) => MaybePromise<R>): MaybePromise<R>;
}
