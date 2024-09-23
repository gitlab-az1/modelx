import { Exception } from './@internals/errors';


const $first = Symbol('PAIR::INTERNAL_DESCRIPTOR.FirstObject');
const $second = Symbol('PAIR::INTERNAL_DESCRIPTOR.SecondObject');
const $frozen = Symbol('PAIR::INTERNAL_DESCRIPTOR.FrozenObject');


export class Pair<F, S> {
  readonly [$first]: F;
  readonly [$second]: S;

  public constructor(
    _first: F,
    _second: S // eslint-disable-line comma-dangle
  ) {
    this[$first] = _first;
    this[$second] = _second;
  }

  public get first(): F {
    return this[$first];
  }

  public get second(): S {
    return this[$second];
  }

  public equals(pair: Pair<F, S> | MutablePair<F, S>): boolean {
    return this[$first] === pair[$first] && this[$second] === pair[$second];
  }

  public strictEquals(pair: Pair<F, S>): boolean {
    return pair instanceof Pair && this[$first] === pair[$first] && this[$second] === pair[$second];
  }

  public toString(): string {
    return `Pair(${this[$first]}, ${this[$second]})`;
  }

  public toArray(): readonly [F, S] {
    return Object.freeze([ this[$first], this[$second] ]);
  }

  public static of<F, S>(_first: F, _second: S): Pair<F, S> {
    return new Pair(_first, _second);
  }

  public static fromArray<F, S>(arr: readonly [F, S]): Pair<F, S> {
    return new Pair(arr[0], arr[1]);
  }

  public static fromObject<F, S>(obj: { first: F; second: S }): Pair<F, S> {
    return new Pair(obj.first, obj.second);
  }

  public static fromJson<F, S>(json: string): Pair<F, S> {
    const obj = JSON.parse(json);

    if(!obj || !obj.first || !obj.second) {
      throw new Exception(`Cannot parse '${json}' to Pair object`, 'ERR_INVALID_ARGUMENT');
    }

    return new Pair(obj.first, obj.second);
  }

  public static fromString<F, S>(str: string): Pair<F, S> {
    const arr = str
      .replace('Pair(', '')
      .replace('MutablePair(', '')
      .replace(')', '')
      .split(', ')
      .map((el) => el.trim());

    if(!arr || arr.length !== 2) {
      throw new Exception(`Cannot parse '${str}' to Pair object`, 'ERR_INVALID_ARGUMENT');
    }

    return new Pair(arr[0] as F, arr[1] as S);
  }
}

export class MutablePair<F, S> {
  [$first]: F;
  [$second]: S;
  [$frozen]: boolean = false;

  public constructor(
    _first: F,
    _second: S // eslint-disable-line comma-dangle
  ) {
    this[$first] = _first;
    this[$second] = _second;
  }

  public get first(): F {
    return this[$first];
  }

  public set first(value: F) {
    if(this[$frozen]) {
      throw new Exception('Cannot modify a frozen Pair object', 'ERR_RESOURCE_LOCKED');
    }

    this[$first] = value;
  }

  public get second(): S {
    return this[$second];
  }

  public set second(value: S) {
    if(this[$frozen]) {
      throw new Exception('Cannot modify a frozen Pair object', 'ERR_RESOURCE_LOCKED');
    }

    this[$second] = value;
  }

  public equals(pair: MutablePair<F, S> | Pair<F, S>): boolean {
    return this[$first] === pair[$first] && this[$second] === pair[$second];
  }

  public strictEquals(pair: MutablePair<F, S>): boolean {
    return pair instanceof MutablePair && this[$first] === pair[$first] && this[$second] === pair[$second];
  }

  public toString(): string {
    return `MutablePair(${this[$first]}, ${this[$second]})`;
  }

  public toArray(): readonly [F, S] {
    return Object.freeze([ this[$first], this[$second] ]);
  }

  public freeze(): void {
    if(this[$frozen]) return;
    this[$frozen] = true;
  }

  public static of<F, S>(_first: F, _second: S): MutablePair<F, S> {
    return new MutablePair(_first, _second);
  }

  public static fromArray<F, S>(arr: readonly [F, S]): MutablePair<F, S> {
    return new MutablePair(arr[0], arr[1]);
  }

  public static fromObject<F, S>(obj: { first: F; second: S }): MutablePair<F, S> {
    return new MutablePair(obj.first, obj.second);
  }

  public static fromJson<F, S>(json: string): MutablePair<F, S> {
    const obj = JSON.parse(json);

    if(!obj || !obj.first || !obj.second) {
      throw new Exception(`Cannot parse '${json}' to Pair object`, 'ERR_INVALID_ARGUMENT');
    }

    return new MutablePair(obj.first, obj.second);
  }

  public static fromString<F, S>(str: string): MutablePair<F, S> {
    const arr = str
      .replace('Pair(', '')
      .replace('MutablePair(', '')
      .replace(')', '')
      .split(', ')
      .map((el) => el.trim());

    if(!arr || arr.length !== 2) {
      throw new Exception(`Cannot parse '${str}' to Pair object`, 'ERR_INVALID_ARGUMENT');
    }

    return new MutablePair(arr[0] as F, arr[1] as S);
  }

  public static fromPair<F, S>(pair: Pair<F, S>): MutablePair<F, S> {
    return new MutablePair(pair.first, pair.second);
  }
}
