import { Exception } from './@internals/errors';
import { Either, left, right } from './@internals/either';
import { assertString, isThenable, str } from './@internals/util';
import type { MaybePromise, GenericFunction, Dict, LooseAutocomplete } from './@internals/types';


export interface DefaultEnvironment {
  GET_LAST_ERROR: () => Error | Exception | null;
}


export type FlagRegistryEntry = {
  evaluationFn: () => MaybePromise<string | number | boolean | GenericFunction>;
  setHook?: (value: string | number | boolean) => void;
};

export type EnvironmentInit = {
  ignoreProcessEnv?: boolean;
  env?: Dict<string | number | null | undefined>;
};

export class Environment {
  private readonly _flagsRegistry: Map<string, FlagRegistryEntry> = new Map();
  private readonly _variables: Map<string, string | number | boolean | GenericFunction>;
  private readonly _constants: Map<string, string | number | boolean | GenericFunction> = new Map();
  private readonly _evaluatedFlags: Map<string, string | number | boolean | GenericFunction> = new Map();

  public constructor(init?: EnvironmentInit) {
    let vars = null! as Dict<any>;

    if(init?.ignoreProcessEnv === true) {
      vars = init.env || {};
    } else {
      vars = Object.assign({}, process.env, init?.env);
    }

    this._variables = new Map(Object.entries(vars).filter((_, x) => typeof x !== 'undefined'));
    vars = null!;
  }

  public variables(): Dict<string | number | boolean | GenericFunction | null | undefined> {
    return Object.fromEntries(this._variables.entries());
  }

  public flags(): Dict<string | number | boolean | GenericFunction | null | undefined> {
    return Object.fromEntries(this._evaluatedFlags.entries());
  }

  public constants(): Dict<string | number | boolean | GenericFunction | null | undefined> {
    return Object.fromEntries(this._constants.entries());
  }

  public define(key: string, value: string | number | boolean | GenericFunction): Either<Exception, void> {
    const isString = str(key);
    if(isString.isLeft()) return isString;

    // eslint-disable-next-line no-extra-boolean-cast
    if(this._constants.has(key)) return left(new Exception(`Cannot redeclare variable "${key}"`, 'ERR_ENVIRONMENT_VARIABLE_REDECLARATION'));

    const isValue = val(value);
    if(isValue.isLeft()) return isValue;

    this._constants.set(key, value);
    return right(void 0);
  }

  public defined(key: string): boolean {
    assertString(key);
    return this._constants.has(key);
  }

  public declare(key: string, value: string | number | boolean | GenericFunction | null): void {
    assertString(key);
    assertValue(value);

    if(value === null) {
      this._variables.delete(key);
    } else {
      this._variables.set(key, value);
    }
  }

  public registerFlag(): void {
    void this._flagsRegistry;
  }

  public get<K extends keyof DefaultEnvironment, T extends string | number | boolean | GenericFunction = DefaultEnvironment[K]>(key: LooseAutocomplete<K>): T | null {
    assertString(key);

    if(this._constants.has(key)) return this._constants.get(key) as any;
    if(this._variables.has(key)) return this._variables.get(key) as any;

    if(this._evaluatedFlags.has(key)) return this._evaluatedFlags.get(key) as any;
    if(!this._flagsRegistry.has(key)) return null;

    const result = this.#eval(key);

    if(isThenable(result)) {
      throw new Exception(`Flag "${key}" cannot be synchronously evaluated.`, 'ERR_UNEXPECTED_PROMISE');
    }

    this._evaluatedFlags.set(key, result);
    return result as any;
  }

  public async getAsync<K extends keyof DefaultEnvironment, T extends string | number | boolean | GenericFunction = DefaultEnvironment[K]>(key: LooseAutocomplete<K>): Promise<T | null> {
    assertString(key);

    if(this._constants.has(key)) return this._constants.get(key) as any;
    if(this._variables.has(key)) return this._variables.get(key) as any;

    if(this._evaluatedFlags.has(key)) return this._evaluatedFlags.get(key) as any;
    if(!this._flagsRegistry.has(key)) return null;

    const result = await this.#eval(key);
    this._evaluatedFlags.set(key, result);

    return result as any;
  }

  #eval(flag: string): MaybePromise<string | number | boolean | GenericFunction> {
    assertString(flag);

    if(!this._flagsRegistry.has(flag)) {
      throw new Exception(`Cannot evaluate nonexistent flag "${flag}"`, 'ERR_UNSUPPORTED_OPERATION');
    }

    return this._flagsRegistry.get(flag)!.evaluationFn();
  }
}


export function assertValue(value: unknown, msg?: string): asserts value is string | number | boolean {
  if(!value ||
    (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean' &&
      typeof value !== 'function'
    )
  ) {
    throw new Exception(msg || `Cannot use 'typeof ${typeof value}' as 'typeof string | number | boolean | function'`, 'ERR_INVALID_TYPE', {
      actual: value,
      expected: 'typeof string | number | boolean | function',
    });
  }
}

export function val(input: any): Either<Exception, void> {
  try {
    assertValue(input);
    return right(void 0);
  } catch (e: any) {
    return left(e);
  }
}


let lastError: Error | null = null;
let __$__global_env: Environment | null = null;

export function createGlobal(): void {
  if(!__$__global_env) {
    __$__global_env = new Environment();
    __$__global_env.define('GET_LAST_ERROR', () => lastError);
  }
}

export function setLastError(err: Error) {
  lastError = err;
}

export function env(): Environment {
  if(!__$__global_env) {
    createGlobal();
  }

  return __$__global_env!;
}

export default Environment;
