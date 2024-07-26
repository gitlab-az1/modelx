
export type Dict<T> = {
  [key: string]: T;
};

export type MaybePromise<T> = T | Promise<T>;

export type LooseAutocomplete<T extends string | number | symbol> = T | Omit<string, T>;
