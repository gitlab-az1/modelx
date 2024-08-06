import { EventEmitter } from '@ts-overflow/async/events';
import { EventLoop } from '@ts-overflow/async/event-loop';
import { IDisposable, Disposable } from '@ts-overflow/node-framework/disposable';

import { jsonSafeStringify } from './json';
import { Exception, Stacktrace } from './errors';


export type CancellationRequestListener = (listener: (e: any) => any, thisArgs?: any, disposables?: IDisposable[]) => IDisposable;

export interface ICancellationToken {
  /**
	 * A flag signalling is cancellation has been requested.
	 */
	readonly isCancellationRequested: boolean;

	/**
	 * An event which fires when cancellation is requested. This event
	 * only ever fires `once` as cancellation can only happen once. Listeners
	 * that are registered after cancellation will be called (next event loop run),
	 * but also only once.
	 *
	 * @event
	 */
	readonly onCancellationRequested: CancellationRequestListener;
}


const shortcutEvent = Object.freeze(function (callback: (...args: any[]) => any, context?: any): IDisposable {
  return EventLoop.immediate(callback.bind(context));
});

export function isCancellationToken(arg: unknown): arg is ICancellationToken {
  if(typeof arg !== 'object' || !arg || Array.isArray(arg)) return false;

  const candidate = (<ICancellationToken>arg);

  return typeof candidate.isCancellationRequested === 'boolean' &&
    typeof candidate.onCancellationRequested === 'function';
}


// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace CancellationToken {
  export const None = Object.freeze<ICancellationToken>({
    isCancellationRequested: false,
    onCancellationRequested: () => Object.freeze<IDisposable>({ dispose() { } }),
  });
  
  export const Cancelled = Object.freeze<ICancellationToken>({
    isCancellationRequested: true,
    onCancellationRequested: shortcutEvent,
  });
}


class MutableToken extends Disposable implements ICancellationToken {
  private _isCancelled: boolean = false;
  private _emitter: EventEmitter<any> | null = null;

  public get isCancellationRequested(): boolean {
    return this._isCancelled;
  }

  public get onCancellationRequested(): CancellationRequestListener {
    if(this._isCancelled) return shortcutEvent;

    if(!this._emitter) {
      this._emitter = new EventEmitter({ onListenerError: console.error });
    }

    return ((listener, thisArgs, disposables) => {
      if(!this._isCancelled) return this._emitter?.subscribe('cancellationrequest', listener, thisArgs);

      if(disposables && Array.isArray(disposables)) {
        disposables.push(shortcutEvent(listener, thisArgs));
        
        for(const d of disposables) {
          super._register(d);
        }
      } else return listener.call(thisArgs, void 0);
    }) as CancellationRequestListener;
  }

  public cancel(reason?: any) {
    if(this._isCancelled) return;

    this._isCancelled = true;
    if(!this._emitter) return this.dispose();

    this._emitter.fire('cancellationrequest', reason ?? void 0);
    this.dispose();
  }

  public override dispose(): void {
    if(this._emitter instanceof EventEmitter) {
      this._emitter.dispose();
      this._emitter = null;
    }

    super.dispose();
  }
}


export class CancellationTokenSource {
  private _token?: ICancellationToken | null = null;
  private _parentListener?: IDisposable | null = null;

  public constructor(private readonly _parent?: ICancellationToken) {
    if(!_parent) return;
    this._parentListener = _parent.onCancellationRequested(this.cancel, this);
  }

  public get token(): ICancellationToken {
    if(!this._token) {
      this._token = new MutableToken();
    }

    return this._token;
  }

  public get parent(): ICancellationToken | undefined {
    return this._parent;
  }

  public cancel(reason?: any, location?: Stacktrace): void {
    if(!this._token) {
      this._token = CancellationToken.Cancelled;
    } else if(this._token instanceof MutableToken) {
      const reasonStr = String(!['string', 'number'].includes(typeof reason) ? jsonSafeStringify(reason) || '' : reason);

      this._token.cancel(reason ?
        `${reasonStr}\n  at ${(location instanceof Stacktrace ? location : new Exception(reasonStr, -1).stackTrace.value).toString().replace(/Error/, `Error: ${reasonStr}`)}` :
        void 0);
    }
  }

  public dispose(cancel: boolean = false, cancellationReason?: any): void {
    if(cancel === true) {
      this.cancel(cancellationReason);
    }

    this._parentListener?.dispose();

    if(!this._token) {
      this._token = CancellationToken.None;
    } else if(this._token instanceof MutableToken) {
      this._token.dispose();
    }
  }
}
