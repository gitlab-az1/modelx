import { setLastError } from '../environment';
import { Exception } from '../@internals/errors';
import { generateRandomBytes } from '../crypto/random';
import type { ArrayValues, Dict } from '../@internals/types';
import { assertArray, assertString } from '../@internals/util';
import { ArrayField, KSDB_DATA_TYPE, Schema, SchemaToObject, type FieldValue, type SchemaField } from './schema';


export async function generateComplexDocumentId(): Promise<Buffer> {
  const timestamp = BigInt(Date.now()); // Get current timestamp in milliseconds as a BigInt

  // UUIDv7 Format: time_high (48 bits) | version (4 bits) | random (78 bits)
  const timeHigh = timestamp & BigInt('0xFFFFFFFFFFFF'); // Extract the 48-bit timestamp
  const version = BigInt(0x7) << 12n; // Version 7 placed at the correct position

  // Combine time and version
  const uuidTime = timeHigh << 16n | version;

  // Generate 78-bit random number
  // const randomBytes = getRandomValues(new Uint8Array(10)); // Get 10 random bytes (80 bits)
  const randomBytes = await generateRandomBytes(10); // Get 10 random bytes (80 bits)
  randomBytes[0] = randomBytes[0] & 0x3f | 0x80; // Adjust the first 2 bits for the variant

  const randomPart = BigInt('0x' + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join(''));

  // Combine uuidTime and randomPart to form the final UUIDv7
  const uuid = (uuidTime << 78n) | randomPart;

  // Convert the UUID to a hexadecimal string and format it
  const hex = uuid.toString(16).padStart(32, '0');
    
  // Insert hyphens to match the UUID format
  return Buffer.from([
    hex.substring(0, 8),
    hex.substring(8, 12),
    `7${hex.substring(13, 16)}`,
    hex.substring(16, 20),
    hex.substring(20),
  ].join('-'));
}


export async function generateDocumentId(): Promise<Buffer> {
  // Current timestamp in milliseconds
  const timestamp = Date.now();

  // Convert timestamp to hexadecimal and pad to ensure 12 characters (48 bits)
  const timestampHex = timestamp.toString(16).padStart(12, '0');

  // Generate 10 random bytes for the rest of the UUID
  const randomBytes = await generateRandomBytes(10);

  // Convert random bytes to hexadecimal
  const randomHex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  // Construct the UUIDv7
  return Buffer.from([
    timestampHex.substring(0, 8),                // time_low
    timestampHex.substring(8, 12),               // time_mid
    `7${randomHex.substring(0, 3)}`,             // version + part of random
    (parseInt(randomHex.substring(3, 5), 16) & 0x3f | 0x80).toString(16).padStart(2, '0') + randomHex.substring(5, 7), // variant + random
    randomHex.substring(7, 15),                  // remaining random
  ].join('-'));
}


export interface DocumentObject {
  readonly _id: string;
}


export type DocumentOptions = {
  avoidDynamicArrays?: boolean;
}

export class Document<T extends Dict<SchemaField>> {
  public static async create<T extends Dict<SchemaField>>(schema: Schema<T>, items: Partial<SchemaToObject<T>>, options?: DocumentOptions): Promise<Document<T>> {
    const f = {} as Dict<any>;
    
    for(const field of schema.fields()) {
      if(!items[field] && (items[field] != null && (<any>schema.describe(field)).notNull !== true)) {
        const descriptor = schema.describeNormalized<ArrayField>(field);
        if(descriptor.type !== KSDB_DATA_TYPE.ARRAY) continue;

        f[field] = typeof descriptor.length === 'number' ? new Array(descriptor.length) : [];
      } else if(field === 'created_at' || field === 'updated_at') {
        f[field] = new Date();
      } else {
        f[field] = items[field];
      }
    }

    const id = await generateDocumentId();
    return new Document(schema, f, id, options);
  }

  readonly #id: Buffer;
  readonly #schema: Schema<T>;
  readonly #o: DocumentOptions;
  #fields: Dict<any> = {};

  private constructor(
    _schema: Schema<T>,
    _fields: Dict<any>,
    _idBuffer: Buffer,
    _options?: DocumentOptions // eslint-disable-line comma-dangle
  ) {
    this.#id = _idBuffer;
    this.#schema = _schema;

    this.#o = Object.assign({}, _options, {
      avoidDynamicArrays: true,
    } satisfies DocumentOptions);

    for(const prop in _fields) {
      const d = _schema.describeNormalized<ArrayField>(prop);
      if(d.type !== KSDB_DATA_TYPE.ARRAY) continue;

      if(typeof d.length !== 'number' && this.#o.avoidDynamicArrays !== false) {
        throw setLastError(new Exception(`You must specify the length of array field '${prop}'`, 'ERR_INVALID_ARGUMENT'));
      }
    }

    this.#fields = _fields;

    for(const key of this.#schema.fields()) {
      const d = this.#schema.describe(key);

      if(!this.#fields[key] && typeof d.default !== 'undefined') {
        this.#fields[key] = d.default;
      }
    }

    for(const prop in this.#fields) {
      const d = _schema.describeNormalized(prop);

      if(d.type === KSDB_DATA_TYPE.ARRAY) {
        for(const item of this.#fields[prop]) {
          this.#assertArrayValue(prop, item);
        }
      } else {
        this.#assertFieldValue(prop, this.#fields[prop]);
      }
    }
  }

  public get _id(): string {
    return this.#id.toString().replace(/-/g, '');
  }

  public set<K extends keyof T>(field: K, value: FieldValue<T[K]>): void {
    assertString(field);

    if(Array.isArray(this.#fields[field])) {
      if(!Array.isArray(value)) {
        value = [value] as any;
      }

      assertArray(value);

      if(value.length <= this.#fields[field].length) {
        for(let i = 0; i < value.length; i++) {
          this.#assertArrayValue(field, value[i]);
          this.#fields[field][i] = value[i];
        }
      } else {
        for(let i = 0; i < this.#fields[field].length; i++) {
          this.#assertArrayValue(field, value[i]);
          this.#fields[field][i] = value[i];
        }
      }
    } else {
      this.#assertFieldValue(field, value);
      this.#fields[field] = value;
    }
  }

  public get<K extends keyof T, R extends FieldValue<T[K]>>(field: K): R {
    assertString(field);
    
    const d = this.#schema.describeNormalized<ArrayField>(field);
    return d.type === KSDB_DATA_TYPE.ARRAY ? [...this.#fields[field]] : this.#fields[field];
  }

  public push<K extends keyof T>(field: K, value: ArrayValues<FieldValue<T[K]>>, index?: number): number {
    this.#assertField(field, KSDB_DATA_TYPE.ARRAY);
    this.#assertArrayValue(field, value);

    let i = -1;
    const fdescriptor = this.#schema.describe<ArrayField>(field);

    if(typeof index === 'number') {
      if(!Number.isSafeInteger(index) || !Number.isFinite(index)) {
        throw setLastError(new Exception('Array index must be a safe and positive integer greater than -1', 'ERR_INVALID_ARGUMENT'));
      }
      
      if(
        index < 0 ||
        (typeof fdescriptor.length === 'number' && index > fdescriptor.length - 1)
      ) {
        throw setLastError(new Exception(`Array index out of bounds in \`Document.push\` [${index}]`, 'ERR_OUT_OF_BOUNDS'));
      }

      this.#fields[field][index] = value;
      i = index;
    } else {
      i = this.#fields[field].push(value) - 1;
    }

    // eslint-disable-next-line no-extra-boolean-cast
    if(!!this.#fields.updated_at) {
      this.#fields.updated_at = new Date();
    }

    return i;
  }

  public splice<K extends keyof T>(field: K, { index, value }: { index?: number; value?: ArrayValues<FieldValue<T[K]>> }): number {
    this.#assertField(field, KSDB_DATA_TYPE.ARRAY);

    let resultIndex = -1;
    const fdescriptor = this.#schema.describe<ArrayField>(field);

    if(typeof index === 'number') {
      if(
        index < 0 ||
        (typeof fdescriptor.length === 'number' && index > fdescriptor.length - 1)
      ) {
        throw setLastError(new Exception(`Array index out of bounds in \`Document.splice\` [${index}]`, 'ERR_OUT_OF_BOUNDS'));
      }

      resultIndex = index;
      (this.#fields[field] as any[]).splice(index, 1);
      // eslint-disable-next-line no-extra-boolean-cast
    } else if(!!value) {
      const i = (this.#fields[field] as any[]).findIndex(x => x === value);

      if(i < 0) {
        throw setLastError(new Exception(`Element 'typeof ${typeof value}' not found in array`, 'ERR_INVALID_ARGUMENT'));
      }

      resultIndex = i;
      (this.#fields[field] as any[]).splice(i, 1);
    } else {
      throw setLastError(new Exception('Cannot unshift from array an undefined element or from a non-set index', 'ERR_INVALID_ARGUMENT'));
    }

    const prevUpdateDate = this.#fields['updated_at'];

    // eslint-disable-next-line no-extra-boolean-cast
    if(!!this.#fields.updated_at) {
      this.#fields.updated_at = new Date();
    }

    if(this.#o.avoidDynamicArrays !== false) return resultIndex;

    try {
      if(typeof fdescriptor.length === 'number') return resultIndex;
      if(!this.#hasHolesInArray(field)) return resultIndex;

      this.#resizeDynamicArray(field);
      return resultIndex;
    } catch (e: any) {
      setLastError(e);

      // eslint-disable-next-line no-extra-boolean-cast
      if(!!this.#fields.updated_at) {
        this.#fields.updated_at = prevUpdateDate;
      }

      throw e;
    }
  }

  public toObject(): SchemaToObject<T> & DocumentObject {
    return Object.assign({}, Object.freeze({ _id: this.#id.toString().replace(/-/g, '') }), this.#fields) as any;
  }

  public async save(): Promise<void> {
    //
  }

  #assertField(key: any, type: KSDB_DATA_TYPE): asserts key is string {
    assertString(key, 'Field name must be a string');

    switch(type) {
      case KSDB_DATA_TYPE.ARRAY: {
        const descriptor = this.#schema.describe(key) as { type: string | number };

        if(descriptor.type !== 'array' && descriptor.type !== KSDB_DATA_TYPE.ARRAY) {
          throw setLastError(new Exception(`Cannot use '${key}' as a document field for { ${type} }`, 'ERR_UNSUPPORTED_OPERATION'));
        }

        if(this.#isEmptyBucket(key)) {
          const fd = this.#schema.describe<ArrayField>(key);
          this.#fields[key] = typeof fd.length === 'number' ? new Array(fd.length) : [];
        }

        if(!Array.isArray(this.#fields[key])) {
          throw setLastError(new Exception(`Cannot use '${key}' as a document field for { ${type} }`, 'ERR_UNSUPPORTED_OPERATION'));
        }
      } break;
      case KSDB_DATA_TYPE.TEXT: {
        const descriptor = this.#schema.describe(key) as { type: string | number };

        if(descriptor.type !== 'text' && descriptor.type !== KSDB_DATA_TYPE.TEXT) {
          throw setLastError(new Exception(`Cannot use '${key}' as a document field for { ${type} }`, 'ERR_UNSUPPORTED_OPERATION'));
        }

        if(this.#fields[key] == null) return;

        if(typeof this.#fields[key] !== 'string') {
          throw setLastError(new Exception(`Cannot use '${key}' as a document field for { ${type} }`, 'ERR_UNSUPPORTED_OPERATION'));
        }
      } break;
      case KSDB_DATA_TYPE.INTEGER: {
        const descriptor = this.#schema.describe(key) as { type: string | number };

        if(descriptor.type !== 'int' && descriptor.type !== KSDB_DATA_TYPE.INTEGER) {
          throw setLastError(new Exception(`Cannot use '${key}' as a document field for { ${type} }`, 'ERR_UNSUPPORTED_OPERATION'));
        }

        if(this.#fields[key] == null) return;

        if(typeof this.#fields[key] !== 'number' || !Number.isInteger(this.#fields[key])) {
          throw setLastError(new Exception(`Cannot use '${key}' as a document field for { ${type} }`, 'ERR_UNSUPPORTED_OPERATION'));
        }
      } break;
      case KSDB_DATA_TYPE.DECIMAL: {
        const descriptor = this.#schema.describe(key) as { type: string | number };

        if(descriptor.type !== 'decimal' && descriptor.type !== KSDB_DATA_TYPE.DECIMAL) {
          throw setLastError(new Exception(`Cannot use '${key}' as a document field for { ${type} }`, 'ERR_UNSUPPORTED_OPERATION'));
        }

        if(this.#fields[key] == null) return;

        if(typeof this.#fields[key] !== 'number' || Number.isInteger(this.#fields[key])) {
          throw setLastError(new Exception(`Cannot use '${key}' as a document field for { ${type} }`, 'ERR_UNSUPPORTED_OPERATION'));
        }
      } break;
      case KSDB_DATA_TYPE.BOOLEAN: {
        const descriptor = this.#schema.describe(key) as { type: string | number };

        if(descriptor.type !== 'bool' && descriptor.type !== KSDB_DATA_TYPE.BOOLEAN) {
          throw setLastError(new Exception(`Cannot use '${key}' as a document field for { ${type} }`, 'ERR_UNSUPPORTED_OPERATION'));
        }

        if(this.#fields[key] == null) return;

        if(typeof this.#fields[key] !== 'boolean') {
          throw setLastError(new Exception(`Cannot use '${key}' as a document field for { ${type} }`, 'ERR_UNSUPPORTED_OPERATION'));
        }
      } break;
      case KSDB_DATA_TYPE.DATETIME: {
        const descriptor = this.#schema.describe(key) as { type: string | number };

        if(descriptor.type !== 'bool' && descriptor.type !== KSDB_DATA_TYPE.BOOLEAN) {
          throw setLastError(new Exception(`Cannot use '${key}' as a document field for { ${type} }`, 'ERR_UNSUPPORTED_OPERATION'));
        }

        if(this.#fields[key] == null) return;

        if(
          !(this.#fields[key] instanceof Date) &&
          Number.isNaN(new Date(this.#fields[key]).getTime())
        ) {
          throw setLastError(new Exception(`Cannot use '${key}' as a document field for { ${type} }`, 'ERR_UNSUPPORTED_OPERATION'));
        }
      } break;
      default:
        throw setLastError(new Exception(`Unrecognized document field '${key}'`, 'ERR_INVALID_ARGUMENT'));
    }
  }

  #assertArrayValue(key: string, value: any): void { // TODO: implement all missing checks
    this.#assertField(key, KSDB_DATA_TYPE.ARRAY);
    const descriptor = this.#schema.describeNormalized<ArrayField>(key);

    switch(descriptor.items.type) {
      case KSDB_DATA_TYPE.INTEGER: {
        if(typeof value !== 'number') {
          throw setLastError(new Exception(`Cannot use 'typeof ${typeof value}' as a integer`, 'ERR_INVALID_ARGUMENT'));
        }

        if(!Number.isInteger(value)) {
          throw setLastError(new Exception(`The value '${value}' is not an integer number`, 'ERR_INVALID_ARGUMENT'));
        }

        if(typeof (<any>descriptor).min === 'number' && value < (<any>descriptor).min) {
          throw setLastError(new Exception(`The value of '${key}' must be ≥ ${(<any>descriptor).min}`, 'ERR_OUT_OF_RANGE'));
        }

        if(typeof (<any>descriptor).max === 'number' && value > (<any>descriptor).max) {
          throw setLastError(new Exception(`The value of '${key}' must be ≤ ${(<any>descriptor).max}`, 'ERR_OUT_OF_RANGE'));
        }
      } break;
      case KSDB_DATA_TYPE.DECIMAL: {
        if(typeof value !== 'number') {
          throw setLastError(new Exception(`Cannot use 'typeof ${typeof value}' as a decimal`, 'ERR_INVALID_ARGUMENT'));
        }

        if(Number.isInteger(value)) {
          throw setLastError(new Exception(`The value '${value}' is not an decimal number`, 'ERR_INVALID_ARGUMENT'));
        }

        if(typeof (<any>descriptor).min === 'number' && value < (<any>descriptor).min) {
          throw setLastError(new Exception(`The value of '${key}' must be ≥ ${(<any>descriptor).min}`, 'ERR_OUT_OF_RANGE'));
        }

        if(typeof (<any>descriptor).max === 'number' && value > (<any>descriptor).max) {
          throw setLastError(new Exception(`The value of '${key}' must be ≤ ${(<any>descriptor).max}`, 'ERR_OUT_OF_RANGE'));
        }
      } break;
      case KSDB_DATA_TYPE.ARRAY: {
        throw setLastError(new Exception('Cannot arrays with more than 1 dimension', 'ERR_INVALID_ARGUMENT'));
      } break;
      case KSDB_DATA_TYPE.BOOLEAN: {
        if(typeof value !== 'boolean') {
          throw setLastError(new Exception(`Cannot use 'typeof ${typeof value}' as a boolean`, 'ERR_INVALID_ARGUMENT'));
        }
      } break;
      case KSDB_DATA_TYPE.DATETIME: {
        if(value instanceof Date) return;
        if(['string', 'number'].includes(typeof value) && !Number.isNaN(new Date(value))) return;

        throw setLastError(new Exception(`Cannot use 'typeof ${typeof value}' as a datetime`, 'ERR_INVALID_ARGUMENT'));
      } break;
      case KSDB_DATA_TYPE.TEXT: {
        if(typeof value !== 'string') {
          throw setLastError(new Exception(`Cannot use 'typeof ${typeof value}' as a text`, 'ERR_INVALID_ARGUMENT'));
        }

        if(typeof (<any>descriptor).minLength === 'number' && value.length < (<any>descriptor).minLength) {
          throw setLastError(new Exception(`The value of '${key}' must be a string with \`length ≥ ${(<any>descriptor).minLength}\``, 'ERR_OUT_OF_RANGE'));
        }

        if(typeof (<any>descriptor).maxLength === 'number' && value.length > (<any>descriptor).maxLength) {
          throw setLastError(new Exception(`The value of '${key}' must be a string with \`length ≤ ${(<any>descriptor).maxLength}\``, 'ERR_OUT_OF_RANGE'));
        }
      } break;
    }
  }

  #assertFieldValue(key: string, value: any): void { // TODO: implement all missing checks
    const descriptor = this.#schema.describeNormalized<ArrayField>(key);

    switch(descriptor.type) {
      case KSDB_DATA_TYPE.INTEGER: {
        if(typeof value !== 'number') {
          throw setLastError(new Exception(`Cannot use 'typeof ${typeof value}' as a integer`, 'ERR_INVALID_ARGUMENT'));
        }

        if(!Number.isInteger(value)) {
          throw setLastError(new Exception(`The value '${value}' is not an integer number`, 'ERR_INVALID_ARGUMENT'));
        }

        if(typeof (<any>descriptor).min === 'number' && value < (<any>descriptor).min) {
          throw setLastError(new Exception(`The value of '${key}' must be ≥ ${(<any>descriptor).min}`, 'ERR_OUT_OF_RANGE'));
        }

        if(typeof (<any>descriptor).max === 'number' && value > (<any>descriptor).max) {
          throw setLastError(new Exception(`The value of '${key}' must be ≤ ${(<any>descriptor).max}`, 'ERR_OUT_OF_RANGE'));
        }
      } break;
      case KSDB_DATA_TYPE.DECIMAL: {
        if(typeof value !== 'number') {
          throw setLastError(new Exception(`Cannot use 'typeof ${typeof value}' as a decimal`, 'ERR_INVALID_ARGUMENT'));
        }

        if(Number.isInteger(value)) {
          throw setLastError(new Exception(`The value '${value}' is not an decimal number`, 'ERR_INVALID_ARGUMENT'));
        }

        if(typeof (<any>descriptor).min === 'number' && value < (<any>descriptor).min) {
          throw setLastError(new Exception(`The value of '${key}' must be ≥ ${(<any>descriptor).min}`, 'ERR_OUT_OF_RANGE'));
        }

        if(typeof (<any>descriptor).max === 'number' && value > (<any>descriptor).max) {
          throw setLastError(new Exception(`The value of '${key}' must be ≤ ${(<any>descriptor).max}`, 'ERR_OUT_OF_RANGE'));
        }
      } break;
      case KSDB_DATA_TYPE.ARRAY: {
        throw setLastError(new Exception('Cannot arrays with more than 1 dimension', 'ERR_INVALID_ARGUMENT'));
      } break;
      case KSDB_DATA_TYPE.BOOLEAN: {
        if(typeof value !== 'boolean') {
          throw setLastError(new Exception(`Cannot use 'typeof ${typeof value}' as a boolean`, 'ERR_INVALID_ARGUMENT'));
        }
      } break;
      case KSDB_DATA_TYPE.DATETIME: {
        if(value instanceof Date) return;
        if(['string', 'number'].includes(typeof value) && !Number.isNaN(new Date(value))) return;

        throw setLastError(new Exception(`Cannot use 'typeof ${typeof value}' as a datetime`, 'ERR_INVALID_ARGUMENT'));
      } break;
      case KSDB_DATA_TYPE.TEXT: {
        if(typeof value !== 'string') {
          throw setLastError(new Exception(`Cannot use 'typeof ${typeof value}' as a text`, 'ERR_INVALID_ARGUMENT'));
        }

        if(typeof (<any>descriptor).minLength === 'number' && value.length < (<any>descriptor).minLength) {
          throw setLastError(new Exception(`The value of '${key}' must be a string with \`length ≥ ${(<any>descriptor).minLength}\``, 'ERR_OUT_OF_RANGE'));
        }

        if(typeof (<any>descriptor).maxLength === 'number' && value.length > (<any>descriptor).maxLength) {
          throw setLastError(new Exception(`The value of '${key}' must be a string with \`length ≤ ${(<any>descriptor).maxLength}\``, 'ERR_OUT_OF_RANGE'));
        }
      } break;
    }
  }

  #resizeDynamicArray(field: string): void {
    let arr = [];

    for(let i = 0; i < this.#fields[field].length; i++) {
      if(!(i in this.#fields[field])) continue;
      arr.push(this.#fields[field][i]);
    }

    this.#fields[field] = null!;
    this.#fields[field] = arr;
    arr = null!;
  }

  #isEmptyBucket(key: string): boolean {
    return typeof this.#fields[key] === 'undefined';
  }

  #hasHolesInArray(key: string): boolean {
    if(!this.#fields[key]) return false;
    if(!Array.isArray(this.#fields[key])) return false;

    for(let i = 0; i < this.#fields[key].length; i++) {
      if(!(i in this.#fields[key])) return true;
    }

    return false;
  }
}
