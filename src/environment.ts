import { Exception } from './@internals/errors';
import { assertString, isThenable, str } from './@internals/util';
import type { MaybePromise } from './@internals/types';
import { Either, left, right } from './@internals/either';


export type FlagRegistryEntry = {
  evaluationFn: () => MaybePromise<string | number | boolean>;
  setHook?: (value: string | number | boolean) => void;
};

export class Environment {
  private readonly _constants: Map<string, string | number | boolean> = new Map();
  private readonly _variables: Map<string, string | number | boolean> = new Map();
  private readonly _evaluatedFlags: Map<string, string | number | boolean> = new Map();
  private readonly _flagsRegistry: Map<string, FlagRegistryEntry> = new Map();

  public define(key: string, value: string | number | boolean): Either<Exception, void> {
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

  public registerFlag(): void {
    void this._flagsRegistry;
  }

  public get(key: string): string | number | boolean | null {
    assertString(key);

    if(this._constants.has(key)) return this._constants.get(key)!;
    if(this._variables.has(key)) return this._variables.get(key)!;

    if(this._evaluatedFlags.has(key)) return key;
    if(!this._flagsRegistry.has(key)) return null;

    const result = this.#eval(key);

    if(isThenable(result)) {
      throw new Exception(`Flag "${key}" cannot be synchronously evaluated.`, 'ERR_UNEXPECTED_PROMISE');
    }

    this._evaluatedFlags.set(key, result);
    return result;
  }

  public async getAsync(key: string): Promise<string | number | boolean | null> {
    assertString(key);

    if(this._constants.has(key)) return this._constants.get(key)!;
    if(this._variables.has(key)) return this._variables.get(key)!;

    if(this._evaluatedFlags.has(key)) return key;
    if(!this._flagsRegistry.has(key)) return null;

    const result = await this.#eval(key);
    this._evaluatedFlags.set(key, result);

    return result;
  }

  #eval(flag: string): MaybePromise<string | number | boolean> {
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
      typeof value !== 'boolean'
    )
  ) {
    throw new Exception(msg || `Cannot use 'typeof ${typeof value}' as 'typeof string | number | boolean'`, 'ERR_INVALID_TYPE', {
      actual: value,
      expected: 'typeof string | number | boolean',
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


let __$__global_env: Environment | null = null;

export function createGlobal(): void {
  if(!__$__global_env) {
    __$__global_env = new Environment();
  }
}

export function env(): Environment {
  if(!__$__global_env) {
    createGlobal();
  }

  return __$__global_env!;
}

export default Environment;
