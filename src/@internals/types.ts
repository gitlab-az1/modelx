
export type Dict<T> = {
  [key: string]: T;
};

export type MaybePromise<T> = T | Promise<T>;

export type MaybeArray<T> = T | T[];

export type ArrayValues<T> = T extends Array<infer V> ? V : never;

export type LooseAutocomplete<T extends string | number | symbol> = T | Omit<string, T>;

export type GenericFunction<TArgs = any, TResult = unknown> = TArgs extends never ?
  () => TResult :
  (...args: TArgs[]) => TResult;


export type PrimitiveDataType = 
  | 'string'
  | 'number'
  | 'boolean'
  | 'undefined'
  | 'function'
  | 'object'
  | 'symbol'
  | 'bigint';

export type DataType = PrimitiveDataType | 'list';

export interface DT {
  string: string;
  number: number;
  boolean: boolean;
  undefined: undefined;
  function: GenericFunction;
  object: object;
  symbol: symbol;
  bigint: bigint;
  list: any[];
}

export type ObjectValues<T extends object> = T[keyof T];
export type ObjectKeys<T extends object> = keyof T;

export type Writable<T> = {
  -readonly [K in keyof T]: T[K];
}


export type BinaryHolder = Buffer | Uint8Array | ArrayBuffer | SharedArrayBuffer | ArrayBufferView;


export type Interval = readonly [number, number];

export type PrimitiveDictionary = Dict<string | number | boolean | null>;
