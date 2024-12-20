import { isThenable } from './@internals/util';
import { Exception } from './@internals/errors';


export type DataType = {
  type: 'integer';
  kind: 'signed' | 'unsigned';
} | {
  type: 'decimal';
  precision: number;
  scale: number;
} | { type: 'string' } | {
  type: 'instanceof';
  construct: any;
} | ((value: unknown) => boolean);


export type ArrayOptions<T> = {
  checkType: DataType;
  initialCollection?: Iterable<T>;
}

export class StrongArray<T> extends Array<T> {
  readonly #length: number | null;
  readonly #options: ArrayOptions<T>;
  #usedBuckets: number;

  public constructor(_length: number, _options: ArrayOptions<T>) {
    super(...(_options.initialCollection || []));

    this.#options = _options;
    this.#usedBuckets = super.length;
    this.#length = _length >= 0 ? _length : null;
  }

  public override push(...values: T[]): number {
    let valid = [] as T[];

    for(let i = 0; i < values.length; i++) {
      if(this.#check(values[i])) {
        valid.push(values[i]);
      }
    }

    if(this.#length && this.#usedBuckets + valid.length > this.#length) {
      valid = valid.slice(0, this.#usedBuckets - this.#length);
    }

    this.#usedBuckets += valid.length - 1;
    return super.push(...valid);
  }

  #check(value: any): boolean {
    if(typeof this.#options.checkType === 'function') {
      const result = this.#options.checkType(value);
      if(typeof result === 'boolean') return result;

      if(isThenable(result)) {
        throw new Exception('The result of an array checker method should be syncrhonous', 'ERR_INVALID_ARGUMENT');
      }

      return !!result;
    }

    switch(this.#options.checkType.type) {
      case 'instanceof': 
        return value instanceof (this.#options.checkType.construct);
      case 'decimal':
        return typeof value === 'number' && !Number.isInteger(value);
      case 'integer':
        if(typeof value !== 'number' || !Number.isInteger(value)) return false;
        if(this.#options.checkType.kind !== 'unsigned') return value >= 0;
        return true;
      case 'string':
        return typeof value === 'string';
    }
  }
}
