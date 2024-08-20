import { setLastError } from '../environment';
import type { Dict } from '../@internals/types';
import { Exception } from '../@internals/errors';


export const enum KSDB_DATA_TYPE {
  TEXT = 0xFF,
  INTEGER = 0x100,
  DECIMAL = 0x101,
  DATETIME = 0x102,
  BOOLEAN = 0x103,
  ARRAY = 0x104,
}


function ftypeToEnum(type: string | number): KSDB_DATA_TYPE {
  if(typeof type === 'number') return type;

  switch(type) {
    case 'text':
      return KSDB_DATA_TYPE.TEXT;
    case 'int':
      return KSDB_DATA_TYPE.INTEGER;
    case 'decimal':
      return KSDB_DATA_TYPE.DECIMAL;
    case 'datetime':
      return KSDB_DATA_TYPE.DATETIME;
    case 'bool':
      return KSDB_DATA_TYPE.BOOLEAN;
    case 'array':
      return KSDB_DATA_TYPE.ARRAY;
    default:
      throw setLastError(new Exception(`Cannot determinate schea type for '${type}'`, 'ERR_INVALID_ARGUMENT'));
  }
}


export type FieldsWithoutArray = (
  | {
    type: 'text';
    notNull?: boolean;
    maxLength?: number;
    minLength?: number;
    default?: string;
  }
  | {
    type: 'int';
    notNull?: boolean;
    length?: 32 | 64;
    default?: number;
    max?: number;
    min?: number;
  }
  | {
    type: 'decimal'
    notNull?: boolean;
    precision?: number;
    length?: 32 | 64;
    default?: number;
    min?: number;
    max?: number;
  }
  | {
    type: 'datetime';
    notNull?: boolean;
    default?: Date | string | number;
  }
  | {
    type: 'bool';
    notNull?: boolean;
    default?: boolean;
  }
);

export type SchemaField = FieldsWithoutArray | {
  type: 'array';
  length?: number;
  default?: any[];
  items: FieldsWithoutArray;
};


export type ArrayField = {
  type: 'array';
  length?: number;
  default?: any[];
  items: FieldsWithoutArray;
};


export type FieldValue<F extends SchemaField | FieldsWithoutArray> = (
  F extends ({ type: 'text'; notNull: true } | { type: 'text'; default: string }) ? string :
  F extends { type: 'text' } ? string | null :

  F extends ({ type: 'int'; notNull: true } | { type: 'int'; default: number }) ? number :
  F extends { type: 'int' } ? number | null :

  F extends ({ type: 'decimal'; default: number } | { type: 'decimal'; notNull: true }) ? number :
  F extends { type: 'decimal' } ? number | null :

  F extends ({ type: 'datetime'; notNull: true } | { type: 'datetime'; default: Date | string | number }) ? Date :
  F extends { type: 'datetime' } ? Date | string | number | null :

  F extends ({ type: 'bool'; notNull: true } | { type: 'bool'; default: boolean }) ? boolean :
  F extends { type: 'bool' } ? boolean | null :

  F extends { type: 'array'; items: infer I extends FieldsWithoutArray } ? FieldValue<I>[] :
  never
);

export type SchemaToObject<T extends Dict<SchemaField>> = { [K in keyof T]: FieldValue<T[K]> };
export type SchemaValue<T extends Dict<SchemaField>, K extends keyof T> = FieldValue<T[K]>;

type NormalizedField<F extends SchemaField> = (
  F extends ({ type: 'array' } | { type: KSDB_DATA_TYPE.ARRAY }) ?
    Omit<F, 'type' | 'items'> & { type: KSDB_DATA_TYPE; items: Omit<FieldsWithoutArray, 'type'> & { type: KSDB_DATA_TYPE } } :
    Omit<F, 'type'> & { type: KSDB_DATA_TYPE }
);

export type SchemaOptions = {
  includeTimestamps?: boolean;
};


export class Schema<T extends Dict<SchemaField>> {
  readonly #props: T;

  public constructor(_props: T, _options?: SchemaOptions) {
    const o = Object.assign({}, _options, { includeTimestamps: true });

    this.#props = o.includeTimestamps === true ? Object.assign({}, _props, {
      created_at: {
        type: 'datetime',
        notNull: true,
      },
      updated_at: {
        type: 'datetime',
        notNull: true,
      },
    } satisfies Dict<SchemaField>) : _props;
  }

  public fields(): readonly string[] {
    return Object.freeze(Object.keys(this.#props));
  }

  public describe<F extends SchemaField>(field: keyof T): F {
    if(!this.#props[field]) {
      throw setLastError(new Exception(`Unknown field '${String(field)}' at schema getter`, 'ERR_INVALID_ARGUMENT'));
    }

    return { ...this.#props[field] } as unknown as F;
  }

  public describeNormalized<F extends SchemaField>(field: keyof T): NormalizedField<F> {
    if(!this.#props[field]) {
      throw setLastError(new Exception(`Unknown field '${String(field)}' at schema getter`, 'ERR_INVALID_ARGUMENT'));
    }

    const x = this.#props[field] as unknown as any;
    Object.assign(x, { type: ftypeToEnum(x.type) });

    if(x.type === KSDB_DATA_TYPE.ARRAY) {
      x.items.type = ftypeToEnum(x.items.type);
    }
    
    return x;
  }
}

export default Schema;
