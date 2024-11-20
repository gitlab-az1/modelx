import fs from 'fs';
import path from 'path';
import { delay } from '@ts-overflow/async/core';

import IOStream from '../io';
import { ensureDir } from '../fs';
import { Exception } from '../@internals/errors';
import { optionalDefined, unwrap } from '../option';
import { chunkToBuffer } from '../@internals/buffer';
import { decryptIfKey, encryptIfKey } from './crypto';
import { BinaryTransformer, File } from './filesystem';
import { Either, left, right } from '../@internals/either';
import { jsonSafeParser, jsonSafeStringify } from '../@internals/json';
import { RedBlackTree, upsert, lookup } from './btree/redBlackTree';


const BUFFER_MASK = Buffer.from('469d18fad7e9', 'hex');
const MAGIC_HEADER = [0x4B, 0x53, 0x44, 0x42];
const HEADER_LENGTH = 4096;


export type TableHeader = (
  | { type: 'text' }
  | { type: 'char' }
  | { type: 'string' }
  | { type: 'varchar'; maxLength: number }
  | { type: 'integer'; kind: 'signed' | 'unsigned'; maxLength?: number }
  | { type: 'decimal'; precisionLength?: number; fixLength?: number }
  | { type: 'bool' }
  | { type: 'null' }
  | { type: 'json' }
  | { type: 'enum'; members: readonly string[] }
  | { type: 'array'; members: Omit<TableHeader, 'fieldName' | 'nullable' | 'constraints'> }
) & {
  fieldName: string;
  nullable: boolean;
  constraints: [];
};

export type InferRuntimeValueFromHeader<T extends TableHeader, Generic = any> = (
  T extends { type: 'text' } ?
    string :
  T extends { type: 'char' } ?
    string | IOStream.Char :
  T extends { type: 'string' } ?
    readonly IOStream.Char[] :
  T extends { type: 'varchar' } ?
    string | readonly IOStream.Char[] :
  T extends { type: 'integer' } | { type: 'decimal' } ?
    number :
  T extends { type: 'bool' } ?
    boolean :
  T extends { type: 'null' } ?
    null :
  T extends { type: 'enum' } ?
    string[] :
  T extends { type: 'json' } ?
    Generic :
  T extends { type: 'array' } ?
    Generic[] :
  never
);

type Header = {
  totalSize: number;
  schemaHeader: TableHeader[];
  rowsLength: number[];
};

export type InferObjectValue<T extends TableHeader, V = never> = (
  V extends never ? 
    T extends { type: 'text' } | { type: 'string' } | { type: 'varchar' } | { type: 'char' } ? 
      InferObjectValue<T, string> : 
    T extends { type: 'integer' } | { type: 'decimal' } ?
      InferObjectValue<T, number> :
    T extends { type: 'bool' } ?
      InferObjectValue<T, boolean> :
    T extends { type: 'enum' } ?
      InferObjectValue<T, string[]> :
    T extends { type: 'array' } ?
      unknown[] :
    T extends { type: 'json' } ?
      unknown :
    T extends { type: 'null' } ?
      null :
    never :
  T['nullable'] extends true ? V | undefined : V
);

export type NativeSchemaObject<T extends { [key: string]: TableHeader }> = {
  [K in keyof T]: InferObjectValue<T[K]>;
};

export type ObjectSchema = {
  [key: string]: TableHeader;
};

type _SchemaObject<T extends object> = {
  [K in keyof T]: {
    value: any;
    cast?: Omit<TableHeader, 'fieldName' | 'nullable' | 'constraints'>;
  };
};


function bTreeComparator(a: [string, unknown], b: [string, unknown]): 1 | 0 | -1 {
  if(a[0] > b[0]) return 1;
  if(a[0] < b[0]) return -1;
  return 0;
}


export type TableOpenProps = {
  filepath: string;
  encryptionKey?: string | Uint8Array | SharedArrayBuffer | ArrayBuffer;
};

export class Table<T extends object> {
  static async #parseHeader(header: Buffer, options: TableOpenProps): Promise<Header> {
    // eslint-disable-next-line no-extra-boolean-cast
    if(!!options.encryptionKey) {
      const decrypted = await decryptIfKey(header, chunkToBuffer(options.encryptionKey));

      if(!Array.isArray(decrypted)) {
        throw new Exception(`Failed to execute decryption routine for table '${path.basename(options.filepath)}'`, 'ERR_UNKNOWN_ERROR');
      }

      header = decrypted[0];
    }

    const magic = header.subarray(0, 4);
    
    for(let i = 0; i < MAGIC_HEADER.length; i++) {
      if(magic[i] !== MAGIC_HEADER[i]) {
        throw new Exception('Failed to parse database header', 'ERR_MAGIC_NUMBER_MISSMATCH');
      }
    }

    const totalSize = header.readUint32LE(4);
    const rowsObjectLength = header.readUint32LE(8);
    const objectSchemaLength = header.readUint32LE(12);

    const parsedSchemaHeader = jsonSafeParser<TableHeader[]>(header.subarray(16 + rowsObjectLength, 16 + rowsObjectLength + objectSchemaLength).toString('utf8'));
    const parsedLengthsObject = jsonSafeParser<number[]>(header.subarray(16, 16 + rowsObjectLength).toString('utf8'));

    if(parsedLengthsObject.isLeft()) {
      throw parsedLengthsObject.value;
    }

    if(parsedSchemaHeader.isLeft()) {
      throw parsedSchemaHeader.value;
    }

    return {
      totalSize,
      schemaHeader: parsedSchemaHeader.value,
      rowsLength: parsedLengthsObject.value,
    };
  }

  static async #createEmptyFile(options: TableOpenProps): Promise<void> {
    let header = Buffer.alloc(HEADER_LENGTH);

    // Write the MAGIC_HEADER to the buffer
    for(let i = 0; i < MAGIC_HEADER.length; i++) {
      header[i] = MAGIC_HEADER[i];
    }

    const emptyArray = unwrap( optionalDefined( jsonSafeStringify([]) ) );
    const emptyArrayLength = Buffer.byteLength(emptyArray);

    // Initialize lengths and other metadata to zero
    header.writeUint32LE(0, 4); // totalSize
    header.writeUint32LE(emptyArrayLength, 8); // rowsObjectLength
    header.writeUint32LE(emptyArrayLength, 12); // objectSchemaLength

    header.write(emptyArray, 16, 'utf8');
    header.write(emptyArray, 16 + emptyArrayLength, 'utf8');

    // eslint-disable-next-line no-extra-boolean-cast
    if(!!options.encryptionKey) {
      const encrytped = await encryptIfKey(header, chunkToBuffer(options.encryptionKey));

      if(!Array.isArray(encrytped)) {
        throw new Exception(`Failed to execute encryption routine for table '${path.basename(options.filepath)}'`, 'ERR_UNKNOWN_ERROR');
      }

      header = encrytped[1];
    }
    
    const file = await File.open(options.filepath, 'w+', { lock: true });

    if(file.isLeft()) {
      throw file.value;
    }

    file.value.pushTransformer(new BinaryTransformer(BUFFER_MASK));
    // file.value.pushTransformer(new ZlibTransformer());

    try {
      await file.value.write(header, 0);
    } finally {
      await file.value.close();
    }
  }

  public static async open<T extends object>(options: TableOpenProps): Promise<Either<Exception, Table<T>>> {
    if(options.filepath.startsWith('../') || options.filepath.startsWith('./')) {
      options.filepath = path.resolve(options.filepath);
    }

    try {
      await ensureDir(path.dirname(options.filepath));

      if(!fs.existsSync(options.filepath)) {
        await this.#createEmptyFile(options);
      }
      
      const file = await File.open(options.filepath, 'r+', { lock: true });

      if(file.isLeft()) {
        throw file.value;
      }

      try {
        // file.value.pushTransformer(new ZlibTransformer());
        file.value.pushTransformer(new BinaryTransformer(BUFFER_MASK));

        const headerBuffer = Buffer.alloc(HEADER_LENGTH);
        await file.value.read(headerBuffer, HEADER_LENGTH, 0);
      
        const header = await this.#parseHeader(headerBuffer, options);
        return right(new Table(file.value, header, options.encryptionKey));
      } catch (err) {
        await file.value.close();
        throw err;
      }
    } catch (error: any) {
      let e = error;

      if(!(error instanceof Exception)) {
        e = new Exception(error.message || error || `An unknown error was occured while opening '${path.basename(options.filepath)}'`, 'ERR_UNKNOWN_ERROR');
      }

      return left(e);
    }
  }

  static #reviveValue<THeader extends TableHeader = TableHeader>(header: THeader, value: any): InferRuntimeValueFromHeader<THeader> {
    switch(header.type) {
      case 'text':
        return String(value) as any;
      case 'varchar':
      case 'string':
        return IOStream.Char.extractFromString(String(value)) as any;
      case 'char':
        return new IOStream.Char(String(value)) as any;
      case 'null':
        return null as any;
      case 'bool':
        return (value === '[TRUE]') as any;
      case 'decimal':
        return parseFloat(value) as any;
      case 'integer':
        return parseInt(value) as any;
      case 'enum': {
        if(Array.isArray(value)) return value.map(String) as any;
        const parsed = jsonSafeParser<string[]>(String(value));

        if(parsed.isLeft()) {
          throw parsed.value;
        }

        if(!Array.isArray(parsed.value)) {
          throw new Error('Inpossible error');
        }

        return parsed.value as any;
      } break;
      case 'array': {
        const parsed = jsonSafeParser<unknown[]>(String(value));

        if(parsed.isLeft()) {
          throw parsed.value;
        }

        if(!Array.isArray(parsed.value)) {
          throw new Error('Impossible error');
        }

        return parsed.value as any;
      } break;
      case 'json': {
        const parsed = jsonSafeParser(String(value));

        if(parsed.isLeft()) {
          throw parsed.value;
        }

        return parsed.value as any;
      } break;
      default:
        throw new Error('Unreachable code');
    }
  }

  readonly #file: File;
  readonly #header: Header;
  readonly #cachedRows: RedBlackTree<[ number, RedBlackTree<[string, unknown]> ]>;

  #encryptionKey?: Buffer;

  readonly #state: {
    byteLength: number;
    closed: boolean;
    ioBlocked: boolean;
  };

  private constructor(
    _file: File,
    _header: Header,
    _ek?: string | Uint8Array | SharedArrayBuffer | ArrayBuffer // eslint-disable-line comma-dangle
  ) {
    process.on('beforeExit', async () => {
      await _file.close();
    });

    this.#file = _file;
    this.#header = _header;
    this.#cachedRows = new RedBlackTree();
    // eslint-disable-next-line no-extra-boolean-cast
    this.#encryptionKey = !!_ek ? chunkToBuffer(_ek) : undefined;
    
    this.#state = {
      closed: false,
      ioBlocked: false,
      byteLength: _header.totalSize,
    };
  }

  #getBalancedTreeFromCache(rowIndex: number): RedBlackTree<[string, unknown]> | null {
    const node = lookup<any>(this.#cachedRows, [rowIndex], (a, b) => {
      if(a[0] > b[0]) return 1;
      if(a[0] < b[0]) return -1;
      return 0;
    });

    return node ? node.content[1] : null;
  }

  #cacheBalancedTree(rowIndex: number, tree: RedBlackTree<[string, unknown]>): void {
    upsert(this.#cachedRows, [rowIndex, tree], (a, b) => {
      if(a[0] > b[0]) return 1;
      if(a[0] < b[0]) return -1;
      return 0;
    });
  }
  // @ts-expect-error The method Table#readRow() is never called
  async #readRow(rowIndex: number, waitTimeout: number = 4000): Promise<RedBlackTree<[string, unknown]>> {
    const cached = this.#getBalancedTreeFromCache(rowIndex);
    if(cached) return cached;

    if(this.#state.ioBlocked) {
      const startTime = Date.now();
      
      while(this.#state.ioBlocked) {
        if(Date.now() - startTime >= waitTimeout) {
          throw new Exception('Timeout exceded waiting to read a table row', 'ERR_RESOURCE_LOCKED');
        }

        await delay(375);
      }
    }

    this.#state.ioBlocked = true;

    try {
      const balancedTree = new RedBlackTree<[string, unknown]>();
      let readOffset = HEADER_LENGTH;

      for(let i = 0; i < rowIndex; i++) {
        readOffset += this.#header.rowsLength[i];
      }

      let rowBuffer = Buffer.alloc(this.#header.rowsLength[rowIndex]);
      await this.#file.read(rowBuffer, this.#header.rowsLength[rowIndex], readOffset + this.#header.rowsLength[rowIndex]);

      // eslint-disable-next-line no-extra-boolean-cast
      if(!!this.#encryptionKey) {
        const decrypted = await decryptIfKey(rowBuffer, this.#encryptionKey);

        if(!Array.isArray(decrypted)) {
          throw new Exception(`Failed to execute decryption routine for table '${this.#file.filename}'`, 'ERR_UNKNOWN_ERROR');
        }

        rowBuffer = decrypted[0];
      }

      const parsedRow = jsonSafeParser<unknown[]>(rowBuffer.toString('utf8'));

      if(parsedRow.isLeft()) {
        throw parsedRow.value;
      }

      if(parsedRow.value.length !== this.#header.schemaHeader.length) {
        throw new Exception('The row length not match with header fields', 'ERR_OUT_OF_BOUNDS');
      }

      for(let i = 0; i < parsedRow.value.length; i++) {
        const header = this.#header.schemaHeader[i];
        upsert(balancedTree, [header.fieldName, Table.#reviveValue(header, parsedRow.value[i])], bTreeComparator);
      }

      this.#cacheBalancedTree(rowIndex, balancedTree);
      return balancedTree;
    } finally {
      this.#state.ioBlocked = false;
    }
  }

  public byteLength(): number {
    if(this.#state.closed) return 0;
    return this.#state.byteLength;
  }

  public countRows(): number {
    if(this.#state.closed) return -1;
    return this.#header.rowsLength.length;
  }

  public async insert(obj: _SchemaObject<T>): Promise<void> {
    void obj;
  }

  public async close(): Promise<void> {
    if(this.#state.closed) return;

    await this.#file.close();
    
    this.#state.byteLength = 0;
    this.#state.ioBlocked = true;
    this.#state.closed = true;
  }
}

export default Table;
