export {
  IAsyncDisposable,
  IDisposable,
  toAsyncDisposable,
  toDisposable,
} from '@ts-overflow/node-framework/disposable';

import { isIterableIterator } from '@ts-overflow/node-framework';
import { IDisposable } from '@ts-overflow/node-framework/disposable';

import { Stacktrace } from './errors';
import { isDisposable } from './disposable';
import { setLastError } from '../environment';


/**
 * Manages a collection of disposable values.
 *
 * This is the preferred way to manage multiple disposables. A `DisposableStore` is safer to work with than an
 * `IDisposable[]` as it considers edge cases, such as registering the same value multiple times or adding an item to a
 * store that has already been disposed of.
 */
export class DisposableStore implements IDisposable {
  public static DISABLE_DISPOSED_WARNING = false;

  private readonly _toDispose = new Set<IDisposable>();
  private _isDisposed = false;

  /**
	 * Dispose of all registered disposables and mark this object as disposed.
	 *
	 * Any future disposables added to this object will be disposed of on `add`.
	 */
  public dispose(): void {
    if(this._isDisposed) return;

    this._isDisposed = true;
    this.clear();
  }

  /**
	 * @return `true` if this object has been disposed of.
	 */
  public get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
	 * Dispose of all registered disposables but do not mark this object as disposed.
	 */
  public clear(): void {
    if(this._toDispose.size === 0) return;

    try {
      dispose(this._toDispose);
    } finally {
      this._toDispose.clear();
    }
  }

  /**
	 * Add a new {@link IDisposable disposable} to the collection.
	 */
  public add<T extends IDisposable>(o: T): T {
    if(!o) return o;

    if((o as unknown as DisposableStore) === this) {
      throw setLastError(new Error('Cannot register a disposable on itself!'));
    }

    if(this._isDisposed) {
      if(!DisposableStore.DISABLE_DISPOSED_WARNING) {
        console.warn(`Trying to add a disposable to a DisposableStore that has already been disposed of. The added object will be leaked!\n  At: ${Stacktrace.create().toString()}`);
      }
    } else {
      this._toDispose.add(o);
    }

    return o;
  }

  /**
	 * Deletes a disposable from store and disposes of it. This will not throw or warn and proceed to dispose the
	 * disposable even when the disposable is not part in the store.
	 */
  public delete<T extends IDisposable>(o: T): void {
    if(!o) return;
    
    if((o as unknown as DisposableStore) === this) {
      throw setLastError(new Error('Cannot dispose a disposable on itself!'));
    }

    this._toDispose.delete(o);
    o.dispose();
  }

  /**
	 * Deletes the value from the store, but does not dispose it.
	 */
  public deleteAndLeak<T extends IDisposable>(o: T): void {
    if(!o) return;

    if(this._toDispose.has(o)) {
      this._toDispose.delete(o);
      // setParentOfDisposable(o, null);
    }
  }
}



/**
 * Manages the lifecycle of a disposable value that may be changed.
 *
 * This ensures that when the disposable value is changed, the previously held disposable is disposed of. You can
 * also register a `MutableDisposable` on a `Disposable` to ensure it is automatically cleaned up.
 */
export class MutableDisposable<T extends IDisposable> implements IDisposable {
  private _value?: T;
  private _isDisposed = false;

  public get value(): T | undefined {
    return this._isDisposed ? undefined : this._value;
  }

  public set value(value: T | undefined) {
    if(this._isDisposed || value === this._value) return;

    this._value?.dispose();
    this._value = value;
  }

  /**
	 * Resets the stored value and disposed of the previously stored value.
	 */
  public clear(): void {
    this.value = undefined;
  }

  public dispose(): void {
    this._isDisposed = true;
    // markAsDisposed(this);
    this._value?.dispose();
    this._value = undefined;
  }

  /**
	 * Clears the value, but does not dispose it.
	 * The old value is returned.
	*/
  public clearAndLeak(): T | undefined {
    const oldValue = this._value;
    this._value = undefined;

    return oldValue;
  }
}


/**
 * Disposes of the value(s) passed in.
 */
export function dispose<T extends IDisposable>(disposable: T): T;
export function dispose<T extends IDisposable>(disposable: T | undefined): T | undefined;
export function dispose<T extends IDisposable, A extends Iterable<T> = Iterable<T>>(disposables: A): A;
export function dispose<T extends IDisposable>(disposables: Array<T>): Array<T>;
export function dispose<T extends IDisposable>(disposables: ReadonlyArray<T>): ReadonlyArray<T>;
export function dispose<T extends IDisposable>(arg: T | Iterable<T> | undefined): any {
  if(isIterableIterator<IDisposable>(arg)) {
    const errors: any[] = [];

    for(const d of arg) {
      if(d) {
        try {
          d.dispose();
        } catch (e) {
          errors.push(e);
        }
      }
    }

    if(errors.length === 1) {
      throw errors[0];
    } else if (errors.length > 1) {
      throw setLastError(new AggregateError(errors, 'Encountered errors while disposing of store'));
    }

    return Array.isArray(arg) ? [] : arg;
  } else if (arg) {
    (arg as T).dispose();
    return arg;
  }
}

export function disposeIfDisposable<T extends IDisposable | object>(disposables: Array<T>): Array<T> {
  for(const d of disposables) {
    if(isDisposable(d)) {
      d.dispose();
    }
  }
  
  return [];
}
