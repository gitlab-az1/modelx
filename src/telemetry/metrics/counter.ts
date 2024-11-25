import { SyncMetric } from './_metric';
import { assert } from '../../@internals/util';


export interface CounterResult {
  readonly value: number;
  readonly name: string;
  readonly description: string | null;
}


export type CounterOptions = {
  initialValue?: number;
  description?: string | null;
}

type CounterState = {
  value: number;
}

export class Counter extends SyncMetric<CounterResult> {
  readonly #name: string;
  readonly #description: string | null;
  readonly #state: CounterState;

  public constructor(name: string, options?: CounterOptions) {
    super('override');

    this.#name = name;
    this.#description = options?.description || null;

    if(options?.initialValue) {
      assert(typeof options.initialValue === 'number' && options.initialValue >= 0);
    }

    this.#state = {
      value: options?.initialValue || 0,
    };
  }

  public get name(): string {
    return this.#name.slice(0);
  }

  public get description(): string | null {
    return this.#description?.slice(0) || null;
  }

  public get value(): number {
    return this.#state.value;
  }

  public increment(value: number): this {
    assert(typeof value === 'number' && value >= 0);
    this.#state.value += value;

    return this;
  }

  public decrement(value: number): this {
    assert(typeof value === 'number' && value >= 0);
    this.#state.value -= value;

    return this;
  }

  public collect(): CounterResult {
    return Object.freeze<CounterResult>({
      value: this.#state.value,
      description: this.#description?.slice(0) || null,
      name: this.#name,
    }); 
  }
}

export default Counter;
