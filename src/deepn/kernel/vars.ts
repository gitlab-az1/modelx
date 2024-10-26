import { Exception } from '../../@internals/errors';
import { isPlainObject } from '../../@internals/util';


export const enum VariableKind {
  Variable,
  Constant,
}

export const enum VariableType {
  String,
  Integer,
  Decimal,
  BigInt,
  Bool,
  Method,
  NullLiteral,
  Struct,
  Array,
  Instance,
}


export interface Variable<T> {
  readonly __environmentBrand: string;
  readonly type: VariableType;
  readonly kind: VariableKind;
  readonly name: string;
  readonly value: T | null | undefined;
}

export interface StringVariable extends Variable<string> {
  readonly type: VariableType.String;
}

export interface IntegerVariable extends Variable<number> {
  readonly type: VariableType.Integer;
}

export interface DecimalVariable extends Variable<number> {
  readonly type: VariableType.Decimal;
}

export interface BigIntVariable extends Variable<bigint> {
  readonly type: VariableType.BigInt;
}

export interface BooleanVariable extends Variable<boolean> {
  readonly type: VariableType.Bool;
}

export interface StructVariable<T extends object> extends Variable<T extends any[] ? never : T> {
  readonly type: VariableType.Struct;
}

export interface ArrayVariable<T> extends Variable<T[]> {
  readonly type: VariableType.Array;
}



const $setMap = Symbol('$::VARIABLES_SET::VARS_MAP');

class VariablesSet {
  readonly [$setMap]: Map<string, Variable<any>> = new Map();

  public declare<T>(v: Variable<T>): VarHandler<T>;
  public declare<T>(name: string, kind: 'var' | 'const', value: T | null | undefined, type?: VariableType): VarHandler<T>;
  public declare<T>(variableOrName: Variable<T> | string, kind?: 'var' | 'const', value?: T | null | undefined, type?: VariableType): VarHandler<T> {
    let obj: Variable<T> | null = null;

    if(typeof variableOrName === 'string') {
      if(!kind) {
        throw new Exception('You must enter the kind of variable to declare', 'ERR_INVALID_ARGUMENT');
      }

      if(!['var', 'const'].includes(kind)) {
        throw new Exception(`Unknown variable kind '${kind}'`, 'ERR_INVALID_TYPE');
      }

      if(this[$setMap].has(variableOrName)) {
        throw new Exception(`Cannot redeclare variable '${variableOrName}'`, 'ERR_KERNEL_VAR_ALREADY_DECLARED');
      }

      if(!value && value !== null && !type) {
        throw new Exception(`Failed to determinate variable type for '${variableOrName}'`, 'ERR_UNKNOWN_VAR_TYPE');
      }

      if(!!type && type !== this.#getVariableType(value)) {
        type = this.#getVariableType(value);
      }

      this[$setMap].set(variableOrName, {
        __environmentBrand: 'deepn-kernel',
        name: variableOrName,
        kind: kind === 'const' ? VariableKind.Constant : VariableKind.Variable,
        type: type || this.#getVariableType(value),
        value,
      });

      obj = this[$setMap].get(variableOrName)!;
    } else {
      assertVariableStruct(variableOrName);

      if(this[$setMap].has(variableOrName.name)) {
        throw new Exception(`Cannot redeclare variable '${variableOrName.name}'`, 'ERR_KERNEL_VAR_ALREADY_DECLARED');
      }

      this[$setMap].set(variableOrName.name, variableOrName);
      obj = variableOrName;
    }

    return new VarHandler({ ...obj });
  }

  public describe<T>(name: string): VarHandler<T> {
    const v = this[$setMap].get(name);

    if(!v) {
      throw new Exception(`Variable '${name}' is not defined`, 'ERR_KERNEL_VAR_NOT_DECLARED');
    }

    return new VarHandler({ ...v });
  }

  public assign<T>(name: string, value: T | null | undefined): void {
    const v = this[$setMap].get(name);

    if(!v) {
      throw new Exception(`Variable '${name}' is not defined`, 'ERR_KERNEL_VAR_NOT_DECLARED');
    }

    if(v.kind === VariableKind.Constant) {
      throw new Exception(`Cannot assign a constant variable '${name}'`, 'ERR_ASSIGN_CONSTANT');
    }

    Object.assign(v, { value });
  }

  public get<T>(name: string): T | null | undefined {
    const v = this[$setMap].get(name);

    if(!v) {
      throw new Exception(`Variable '${name}' is not defined`, 'ERR_KERNEL_VAR_NOT_DECLARED');
    }

    return v.value;
  }

  public delete(name: string): boolean {
    return this[$setMap].delete(name);
  }

  #getVariableType(v: unknown): VariableType {
    if(v === null) return VariableType.NullLiteral;

    switch(typeof v) {
      case 'string':
        return VariableType.String;
      case 'number':
        return Number.isInteger(v) ? VariableType.Integer : VariableType.Decimal;
      case 'bigint':
        return VariableType.BigInt;
      case 'function':
        return VariableType.Method;
      case 'object':
        if(Array.isArray(v)) return VariableType.Array;
        if(isPlainObject(v)) return VariableType.Struct;
        return VariableType.Instance;
      case 'boolean':
        return VariableType.Bool;
      default:
        throw new Exception('Failed to determinate variable type', 'ERR_UNKNOWN_VAR_TYPE');
    }
  }
}


const $vHandlerObject = Symbol('$::VARIABLES_HANDLER::OBJECT_HOLDER');

class VarHandler<T> {
  public readonly [$vHandlerObject]: Variable<T>;

  public constructor(v: Variable<T>) {
    assertVariableStruct(v);
    this[$vHandlerObject] = v;
  }

  public assign(value: T | null | undefined): this {
    vars.assign(this[$vHandlerObject].name, value);
    Object.assign(this[$vHandlerObject], { value });
    
    return this;
  }

  public unref(): this {
    vars.assign(this[$vHandlerObject].name, null);
    vars.delete(this[$vHandlerObject].name);

    return this;
  }
}


function assertVariableStruct<T>(arg: unknown): asserts arg is Variable<T> {
  if(!arg || typeof arg !== 'object' || Array.isArray(arg)) {
    throw new Exception(`Cannot assert 'typeof ${typeof arg}' as 'typeof Variable<unknown>'`, 'ERR_ASSERTATION_FAILED');
  }

  const candidate = (<Variable<T>>arg);

  const is = (
    typeof candidate.__environmentBrand === 'string' &&
    !! candidate.__environmentBrand &&
    [VariableKind.Constant, VariableKind.Variable].includes(candidate.kind) &&
    typeof candidate.name === 'string' &&
    !!candidate.name &&
    typeof candidate.type === 'number'
  );

  if(!is) {
    throw new Exception(`Cannot assert 'typeof ${typeof arg}' as 'typeof Variable<unknown>'`, 'ERR_ASSERTATION_FAILED');
  }
}


const vars = new VariablesSet();


export function variable<T>(name: string, value: T | null | undefined): VarHandler<T> {
  return vars.declare(name, 'var', value);
}

export function constant<T>(name: string, value: T | null | undefined): VarHandler<T> {
  return vars.declare(name, 'const', value);
}

export function vardump<T>(v: VarHandler<T>): string {
  return `(${vartype(v)}) ${v[$vHandlerObject].value}`;
}

export function getvar<T>(name: string): VarHandler<T> | null {
  const v = vars[$setMap].get(name);

  if(!v) return null;
  return new VarHandler({ ...v });
}

export function vartype<T>(v: VarHandler<T>): string {
  switch(v[$vHandlerObject].type) {
    case VariableType.Array:
      return 'array' as const;
    case VariableType.BigInt:
      return 'bigint' as const;
    case VariableType.Bool:
      return 'bool' as const;
    case VariableType.Decimal: 
      return 'decimal' as const;
    case VariableType.Instance:
      return 'ins' as const;
    case VariableType.Integer:
      return 'int' as const;
    case VariableType.Method:
      return 'func' as const;
    case VariableType.NullLiteral:
      return 'null' as const;
    case VariableType.String:
      return 'str' as const;
    case VariableType.Struct:
      return 'struct' as const;
  }
}
