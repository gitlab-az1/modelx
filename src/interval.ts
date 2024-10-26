import { Pair } from './pair';
import { Exception } from './@internals/errors';


const $pair = Symbol('INTERVAL::INTERNAL_DESCRIPTOR.RangePair');


export class Interval {
  public static from(input: string): Interval;
  public static from(start: number, end: number): Interval;
  public static from(input: readonly [number, number]): Interval;
  public static from(input: readonly [number, number] | string | number, end?: number): Interval {
    if(Array.isArray(input)) return new Interval(input as readonly [number, number]);
    if(typeof input === 'number' && typeof end === 'number') return new Interval(input, end);

    if(typeof input !== 'string') {
      throw new Exception(`Failed to determinate interval: ${String(input)}`, 'ERR_INVALID_ARGUMENT');
    }

    if(input[0] !== '{' && input[input.length - 1] !== '}') {
      throw new Exception(`Failed to parse stringified interval '${String(input)}'`, 'ERR_INVALID_ARGUMENT');
    }

    const [s, e] = input
      .replace('{', '')
      .replace('}', '')
      .split(',');

    if(!s || !e || Number.isNaN(Number(s)) || Number.isNaN(Number(e))) {
      throw new Exception(`Failed to parse stringified interval '${String(input)}'`, 'ERR_INVALID_ARGUMENT');
    }

    return new Interval(Number(s), Number(e));
  }

  private [$pair]: Pair<number, number>;

  public constructor(range: readonly [number, number]);
  public constructor(start: number, end: number);
  public constructor(startOrRange: number | readonly [number, number], end?: number) {
    let s = -Infinity + 1, e = Infinity - 1;

    if(Array.isArray(startOrRange)) {
      [s, e] = startOrRange;
    } else {
      if(!end || typeof startOrRange !== 'number') {
        throw new Exception('When the first argument is not an numeric range the `end` value is required', 'ERR_INVALID_ARGUMENT');
      }

      [s, e] = [startOrRange, end];
    }

    if(s > e) {
      throw new Exception(`The end of interval should be greater than or equal start. Received: [${s}, ${e}]`, 'ERR_INVALID_ARGUMENT');
    }

    this[$pair] = new Pair(s, e);
  }

  public get start(): number {
    return this[$pair].first;
  }

  public get end(): number {
    return this[$pair].second;
  }

  public isBetween(value: number): boolean {
    return value >= this[$pair].first && value <= this[$pair].second;
  }

  public getPair(): Pair<number, number> {
    return new Pair(this[$pair].first, this[$pair].second);
  }

  public toArray(): readonly [number, number] {
    return Object.freeze([ this[$pair].first, this[$pair].second ]);
  }

  public toString(): string {
    return `{${this[$pair].first}, ${this[$pair].second}}`;
  }
}

export default Interval;
