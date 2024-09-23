import { Exception } from './@internals/errors';


const enum OptionType {
  None,
  Some,
}


const $type = Symbol('OPTION::INTERNAL_DESCRIPTIOR.Type');
const $value = Symbol('OPTION::INTERNAL_DESCRIPTIOR.Value');


export type None = { [$type]: OptionType.None };
export type Some<T> = { [$type]: OptionType.Some; [$value]: T };
export type Option<T> = None | Some<T>;


export function isSome<T>(option: Option<T>): option is Some<T> {
  return option[$type] === OptionType.Some;
}

export function isNone<T>(option: Option<T>): option is None {
  return option[$type] === OptionType.None;
}


export const none: None = Object.freeze({ [$type]: OptionType.None });
export const some = <T>(value: T) => ({ [$value]: value, [$type]: OptionType.Some });


export function optionalCatch<T>(fn: () => T): Option<T> {
  try {
    return some(fn());
  } catch {
    return none;
  }
}

export async function optionalResolve<T>(p: Promise<T>): Promise<Option<T>> {
  try {
    return some(await p);
  } catch {
    return none;
  }
}


export function toOptional<I, O extends I>(fn: (input: I) => input is O): ((arg: I) => Option<O>) {
  return function(arg: I): Option<O> {
    try {
      return fn(arg) ? some(arg) : none;
    } catch {
      return none;
    }
  };
}

export const optionalDefined = toOptional( <T>(arg: T | null | undefined): arg is T => !!arg );


export function unwrap<T>(option: Option<T>): T {
  if(option[$type] === OptionType.Some) return option[$value];
  throw new Exception('Cannot unwrap a None value', 'ERR_UNWRAP_NONE');
}

export function unwrapOr<T>(option: Option<T>, fallback: T): T {
  if(option[$type] === OptionType.Some) return option[$value];
  return fallback;
}

export function unwrapExpect<T>(option: Option<T>, message?: string): T {
  if(option[$type] !== OptionType.Some) {
    throw new Exception(message || 'Cannot unwrap a None value', 'ERR_UNWRAP_NONE');
  }

  return option[$value];
}


// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace option {
  export type None = { [$type]: OptionType.None };
  export type Some<T> = { [$type]: OptionType.Some; [$value]: T };
  export type Option<T> = None | Some<T>;


  export function isSome<T>(option: Option<T>): option is Some<T> {
    return option[$type] === OptionType.Some;
  }
  
  export function isNone<T>(option: Option<T>): option is None {
    return option[$type] === OptionType.None;
  }


  export const none: None = Object.freeze({ [$type]: OptionType.None });
  export const some = <T>(value: T) => ({ [$value]: value, [$type]: OptionType.Some });


  export function optionalCatch<T>(fn: () => T): Option<T> {
    try {
      return some(fn());
    } catch {
      return none;
    }
  }

  export async function optionalResolve<T>(p: Promise<T>): Promise<Option<T>> {
    try {
      return some(await p);
    } catch {
      return none;
    }
  }


  export function toOptional<I, O extends I>(fn: (input: I) => input is O): ((arg: I) => Option<O>) {
    return function(arg: I): Option<O> {
      try {
        return fn(arg) ? some(arg) : none;
      } catch {
        return none;
      }
    };
  }

  export const optionalDefined = toOptional( <T>(arg: T | null | undefined): arg is T => !!arg );


  export function unwrap<T>(option: Option<T>): T {
    if(option[$type] === OptionType.Some) return option[$value];
    throw new Exception('Cannot unwrap a None value', 'ERR_UNWRAP_NONE');
  }

  export function unwrapOr<T>(option: Option<T>, fallback: T): T {
    if(option[$type] === OptionType.Some) return option[$value];
    return fallback;
  }

  export function unwrapExpect<T>(option: Option<T>, message?: string): T {
    if(option[$type] !== OptionType.Some) {
      throw new Exception(message || 'Cannot unwrap a None value', 'ERR_UNWRAP_NONE');
    }

    return option[$value];
  }
}

export default option;
