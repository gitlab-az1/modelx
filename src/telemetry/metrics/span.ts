import IOStream from '../../io';
import { SyncMetric } from './_metric';
import { timestamp } from '../../timer';
import * as promises from '../../@internals/async';
import { Exception } from '../../@internals/errors';
import { Either, left, right } from '../../@internals/either';
import type { ReadonlyDict, Dict } from '../../@internals/types';


export interface SpanResult<T = never> {
  readonly result: T;
  readonly startedAt: number;
  readonly duration: number;
  readonly name: string;
  readonly description: string | null;
  readonly tags: ReadonlyDict<string>;
  readonly parent: Span<T> | null;
  readonly metadata: {
    readonly highResolutionClock: boolean;
  };
}


type SpanState<T> = {
  parent: Span<T> | null;
  startTime: number;
  endTime?: number;
  highResolutionTimer: boolean;
}

export type SpanOptions<T> = {
  parent?: Span<T>
  description?: string | null;
  useHighResolutionClock?: boolean;
  onStart?: (_span: Span<T>) => void;
  onEnd?: (_span: Span<T>, result: SpanResult<T>) => void;
}

export class Span<T = any> extends SyncMetric<SpanResult<T>> {
  public static fromAsync<T = unknown>(callable: () => Promise<T>, name: string, options?: SpanOptions<T>): Promise<SpanResult<Either<IOStream.Exception.Throwable, T>>> {
    const span = new Span<T>(name, options);

    return promises.withAsyncBody(async resolve => {
      try {
        const result = await callable();

        span.end();
        resolve(span.collect(right(result) as any) as any);
      } catch (err: any) {
        let e = err;

        if(!(err instanceof IOStream.Exception.Throwable)) {
          e = new IOStream.Exception.Throwable(err?.message || String(err) || 'Some unknown error was occured while executing an asynchronous `Span`', {
            code: 'ERR_UNKNOWN_ERROR',
          });
        }

        span.end();
        resolve(span.collect(left(e) as any) as any);
      }
    });
  }

  public static with<T>(callable: (_span: Span<T>) => T, name: string, options?: SpanOptions<T>): SpanResult<Either<IOStream.Exception.Throwable, T>> {
    const span = new Span<T>(name, options);

    try {
      const result = callable(span);

      if(!span.ended) {
        span.end();
      }

      return span.collect(right(result) as any) as any;
    } catch (err: any) {
      let e = err;

      if(!(err instanceof IOStream.Exception.Throwable)) {
        e = new IOStream.Exception.Throwable(err?.message || String(err) || 'Some unknown error was occured while executing an asynchronous `Span`', {
          code: 'ERR_UNKNOWN_ERROR',
        });
      }

      if(!span.ended) {
        span.end();
      }

      return span.collect(left(e) as any) as any;
    }
  }

  readonly #state: SpanState<T>;
  readonly #name: string;
  readonly #description: string | null;
  readonly #tags: Dict<string>;
  readonly #onEnd?: (_span: Span<T>, result: SpanResult<T>) => void;

  public constructor(name: string, options?: SpanOptions<T>) {
    super('override');

    const highResolutionTimer = typeof options?.useHighResolutionClock === 'boolean' ? options.useHighResolutionClock : true;

    this.#state = {
      startTime: timestamp(highResolutionTimer),
      highResolutionTimer,
      parent: options?.parent || null,
    };

    this.#tags = {};
    this.#name = name;
    this.#onEnd = options?.onEnd;
    this.#description = options?.description || null;

    options?.onStart?.(this);
  }

  public get name(): string {
    return this.#name.slice(0);
  }

  public get description(): string | null {
    return this.#description?.slice(0) || null;
  }

  public get ended(): boolean {
    return !!this.#state.endTime;
  }

  public setTag(key: string, value: string): this {
    this.#tags[key] = value;
    return this;
  }

  public end(result?: T): this {
    if(this.#state.endTime) return this;

    this.#state.endTime = timestamp(this.#state.highResolutionTimer);
    this.#onEnd?.(this, this.collect(result));
    
    return this;
  }

  public collect(result?: T): SpanResult<T> {
    if(!this.#state.endTime) {
      throw new Exception('Span has not ended yet', 'ERR_UNSUPPORTED_OPERATION');
    }

    return Object.freeze<SpanResult<T>>({
      description: this.#description,
      duration: this.#state.endTime! - this.#state.startTime,
      name: this.#name,
      startedAt: this.#state.startTime,
      tags: Object.freeze(this.#tags),
      result: result as T,
      parent: this.#state.parent,
      metadata: {
        highResolutionClock: this.#state.highResolutionTimer,
      },
    });
  }
}

export default Span;
