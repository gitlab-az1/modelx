import { Exception } from './errors';
import { type IDisposable } from './disposable';
import type { MaybePromise } from '../@internals/types';


export interface IResult<TReturn> {
  done: boolean;
  value: TReturn | null;
}

export abstract class AbstractIterator<T> {
  protected readonly __ondone: Set<(() => void)> = new Set();

  public abstract next(): MaybePromise<IResult<T>>;
  public abstract prev(): MaybePromise<IResult<T> | null>;
  public abstract seekToFirst(): MaybePromise<void>;
  public abstract seekToLast(): MaybePromise<void>;
  public abstract seek?(index: number): MaybePromise<IResult<T> | null>;
  public abstract clone(): MaybePromise<AbstractIterator<T>>;

  public ondone(callback: () => void): void {
    this.__ondone.add(callback);
  }

  public off(listener: (() => void) | '*'): void {
    if(typeof listener === 'string') {
      if(listener !== '*') {
        throw new Exception(`Unexpected token '${listener}' as '_ondone' listener of iterator`, 'ERR_INVALID_ARGUMENT');
      }

      this.__ondone.clear();
    } else {
      this.__ondone.delete(listener);
    }
  }

  public async toArray(): Promise<readonly T[]> {
    const iter = await this.clone();
    await iter.seekToFirst();

    const result = [] as T[];
    let current = await iter.next();

    while(!current.done) {
      result.push(current.value!);
      current = await iter.next();
    }

    return Object.freeze(result);
  }

  public abstract [Symbol.iterator](): IterableIterator<T>;
}



export class LazyIterator<T> extends AbstractIterator<T> implements IDisposable {
  #collection: T[];
  #cursor: number = 0;

  public constructor(items: Iterable<T>) {
    super();
    this.#collection = Array.from(items);
  }

  public get disposed(): boolean {
    return this.#cursor === -1;
  }

  public next(): IResult<T> {
    if(this.#cursor === -1) {
      throw new Exception('This iterator has been disposed', 'ERR_RESOURCE_DISPOSED');
    }

    if(this.#cursor + 1 >= this.#collection.length) return { done: true, value: null };
    return { done: false, value: this.#collection[++this.#cursor] };
  }

  public prev(): IResult<T> | null {
    if(this.#cursor === -1) {
      throw new Exception('This iterator has been disposed', 'ERR_RESOURCE_DISPOSED');
    }

    if(this.#cursor - 1 < 0) return null;
    return { done: false, value: this.#collection[--this.#cursor] };
  }

  public seekToFirst(): void {
    if(this.#cursor === -1) {
      throw new Exception('This iterator has been disposed', 'ERR_RESOURCE_DISPOSED');
    }

    this.#cursor = 0;
  }

  public seekToLast(): void {
    if(this.#cursor === -1) {
      throw new Exception('This iterator has been disposed', 'ERR_RESOURCE_DISPOSED');
    }

    this.#cursor = this.#collection.length - 1;
  }

  public seek(index: number): IResult<T> | null {
    if(this.#cursor === -1) {
      throw new Exception('This iterator has been disposed', 'ERR_RESOURCE_DISPOSED');
    }

    if(index < 0 || index >= this.#collection.length) return null;

    this.#cursor = index;
    return { done: index === this.#collection.length - 1, value: this.#collection[index] };
  }

  public clone(): LazyIterator<T> {
    if(this.#cursor === -1) {
      throw new Exception('This iterator has been disposed', 'ERR_RESOURCE_DISPOSED');
    }

    const cloned = new LazyIterator([...this.#collection]);
    cloned.#cursor = this.#cursor;

    return cloned;
  }

  public dispose(): void {
    if(this.#cursor === -1) return;

    this.#cursor = -1;
    this.#collection = null!;
  }

  public *[Symbol.iterator](): IterableIterator<T> {
    if(this.#cursor === -1) {
      throw new Exception('This iterator has been disposed', 'ERR_RESOURCE_DISPOSED');
    }

    for(let i = this.#cursor + 1; i < this.#collection.length; i++) {
      yield this.#collection[i];
    }
  }
}


export default AbstractIterator;
