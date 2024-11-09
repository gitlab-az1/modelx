const $bucket = Symbol('$::DEEPN_KERNEL::DEEP_ARRAY->Bucket');


export function asizeof<T>(arr: DeepAbstractArray<T>): number {
  if(!(arr instanceof DeepAbstractArray)) return -1;
  return arr[$bucket].length;
}

export function aindexof<T>(arr: DeepAbstractArray<T>, value: T): number {
  return arr[$bucket].indexOf(value);
}


export type DeepAbstractArrayProps = {
  fixed: boolean;
  readonly: boolean;
}

export class DeepAbstractArray<T> {
  public static fromIterable<T>(iter: Iterable<T>, fixed: boolean = true, readonly: boolean = false): DeepAbstractArray<T> {
    return new DeepAbstractArray(iter, { fixed, readonly });
  }

  readonly [$bucket]: T[];

  private readonly _state: {
    readonly: boolean;
    size: number | false;
  };

  private constructor(iterable: Iterable<T>, initProps?: DeepAbstractArrayProps) {
    this[$bucket] = Array.from(iterable);

    this._state = {
      readonly: false,
      size: initProps?.fixed ? this[$bucket].length : false,
    };
  }

  public push(...values: T[]): boolean {
    if(this._state.readonly) return false;
    if(this._state.size !== false && this[$bucket].length + values.length > this._state.size) return false;
    
    this[$bucket].push(...values);
    return true;
  }

  public splice(index: number, count: number, values: T[]): boolean {
    if(this._state.readonly) return false;
    if(this._state.size !== false && this[$bucket].length - count + values.length > this._state.size) return false;

    this[$bucket].splice(index, count, ...values);
    return true;
  }

  public get(index: number): T | undefined {
    return this[$bucket][index];
  }

  public set(index: number, value: T): boolean {
    if(this._state.readonly) return false;
    
    this[$bucket][index] = value;
    return true;
  }

  public *iterator(): IterableIterator<T> {
    for(const x of this[$bucket]) {
      yield x;
    }
  }

  public freeze(): this {
    if(this._state.readonly) return this;

    this._state.readonly = true;
    return this;
  }
}
