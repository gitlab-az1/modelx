import fs from 'fs';
import path from 'path';
import { delay } from '@ts-overflow/async/core';

import IOStream from '../io';
import { ensureDir } from '../fs';
import { InMemoryQueue } from '../queue';
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
    // This method parse the given Buffer object into a `Header` structure.
    //
    // Header (4096 bytes):
    // +------------------------+---------------------------+---------------------------------------
    // | magic number (4 bytes) | total data size (4 bytes) | byte length of `rowsLength` (4 bytes) 
    // +------------------------+---------------------------+---------------------------------------
    // -----------------------------------+------------------------+--------------------+
    //  byte length of `schema` (4 bytes) | the `rowsLength` array | the `schema` array |
    // -----------------------------------+------------------------+--------------------+

    // eslint-disable-next-line no-extra-boolean-cast
    if(!!options.encryptionKey) { // Decrypt the header buffer if an key is set
      const decrypted = await decryptIfKey(header, chunkToBuffer(options.encryptionKey));

      if(!Array.isArray(decrypted)) {
        throw new Exception(`Failed to execute decryption routine for table '${path.basename(options.filepath)}'`, 'ERR_UNKNOWN_ERROR');
      }

      header = decrypted[0];
    }

    // Read the first 4 bytes of header Buffer
    const magic = header.subarray(0, 4); // Assuming that it is the magic number
    
    for(let i = 0; i < MAGIC_HEADER.length; i++) { // Check if the magic number in header matches with `MAGIC_HEADER`
      if(magic[i] !== MAGIC_HEADER[i]) {
        throw new Exception('Failed to parse database header', 'ERR_MAGIC_NUMBER_MISSMATCH');
      }
    }

    const totalSize = header.readUint32LE(4); // Reads the byte size of all stored data in this table
    const rowsObjectLength = header.readUint32LE(8); // Reads the length of `rowsLength` array
    const objectSchemaLength = header.readUint32LE(12); // Reads the length of `schema` array

    // Try to parse `schema` as JSON
    const parsedSchemaHeader = jsonSafeParser<TableHeader[]>(header.subarray(16 + rowsObjectLength, 16 + rowsObjectLength + objectSchemaLength).toString('utf8'));

    // Try to parse `rowsLength` as JSON
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
    // Creates and write a new empty file for table if not exists

    // Allocates an buffer for header with `HEADER_LENGTH` bytes
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
    if(!!options.encryptionKey) { // Encrypt header buffer is an key is set
      const encrytped = await encryptIfKey(header, chunkToBuffer(options.encryptionKey));

      if(!Array.isArray(encrytped)) {
        throw new Exception(`Failed to execute encryption routine for table '${path.basename(options.filepath)}'`, 'ERR_UNKNOWN_ERROR');
      }

      header = encrytped[1];
    }
    
    // Request an file descriptor for table's filename in write mode
    const file = await File.open(options.filepath, 'w+', { lock: true });

    if(file.isLeft()) {
      throw file.value;
    }

    file.value.pushTransformer(new BinaryTransformer(BUFFER_MASK)); // Prepare file handler to encode/decode binary files with mask `BUFFER_MASK`
    // file.value.pushTransformer(new ZlibTransformer()); -- Skipping compression in this phase

    try {
      // Writes the header to the file
      await file.value.write(header, 0);
    } finally {
      // And finally, closes the file descriptor
      await file.value.close();
    }
  }

  public static async open<T extends object>(options: TableOpenProps): Promise<Either<Exception, Table<T>>> {
    // Open a table to change it's structure or data

    // First, if the filepath is relative
    // we need to make it absolute with `path#resolve()`
    if(options.filepath.startsWith('../') || options.filepath.startsWith('./')) {
      options.filepath = path.resolve(options.filepath);
    }

    try {
      // Ensure that the table's file directory exists
      await ensureDir(path.dirname(options.filepath));

      if(!fs.existsSync(options.filepath)) { // Creates a new empty file with just the header if not exists
        await this.#createEmptyFile(options);
      }
      
      // Request an file descriptor to table's file in read/write mode
      const file = await File.open(options.filepath, 'r+', { lock: true });

      if(file.isLeft()) {
        throw file.value;
      }

      try {
        // file.value.pushTransformer(new ZlibTransformer()); -- Skipping compression in this phase
        file.value.pushTransformer(new BinaryTransformer(BUFFER_MASK)); // Prepare file handler to encode/decode binary files with `BUFFER_MASK`

        // Allocates an buffer to store the header of table
        const headerBuffer = Buffer.alloc(HEADER_LENGTH);

        // Write the header of table into `headerBuffer`
        await file.value.read(headerBuffer, HEADER_LENGTH, 0); 
      
        // Parse the header buffer into a `Header` object
        const header = await this.#parseHeader(headerBuffer, options);

        // Resolve the promise with a new instance of `Table` as `Right`
        return right(new Table(file.value, header, options.encryptionKey));
      } catch (err) { // Ensure the file descriptor will be closed and re-throw the exception if some error occurs
        await file.value.close();
        throw err;
      }
    } catch (error: any) {
      let e = error;

      if(!(error instanceof Exception)) {
        e = new Exception(error.message || error || `An unknown error was occured while opening '${path.basename(options.filepath)}'`, 'ERR_UNKNOWN_ERROR');
      }

      // Reject the promise with the error with `Left`
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
  #cachedRows: RedBlackTree<[ number, RedBlackTree<[string, unknown]> ]>;
  #diskFlushQueue: InMemoryQueue<{ rowIndex: number; tree: RedBlackTree<[string, unknown]> }>;

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
    this.#diskFlushQueue = new InMemoryQueue({ concurrency: 1 });
    
    this.#state = {
      closed: false,
      ioBlocked: false,
      byteLength: _header.totalSize,
    };

    this.#diskFlushQueue.process(async ({ payload }) => {
      await this.#writeRow(payload.rowIndex, payload.tree);
    });
  }

  #getBalancedTreeFromCache(rowIndex: number): RedBlackTree<[string, unknown]> | null {
    // Check if `rowIndex` already have an Red-Black tree cached in memory
    // and if exists, we don't need to read the file again to fetch this data, we're use the cache instead

    const node = lookup<any>(this.#cachedRows, [rowIndex], (a, b) => {
      if(a[0] > b[0]) return 1;
      if(a[0] < b[0]) return -1;
      return 0;
    });

    return node ? node.content[1] : null;
  }

  #cacheBalancedTree(rowIndex: number, tree: RedBlackTree<[string, unknown]>): void {
    // Sets an Red-Black tree into the cache for `rowIndex`

    upsert(this.#cachedRows, [rowIndex, tree], (a, b) => {
      if(a[0] > b[0]) return 1;
      if(a[0] < b[0]) return -1;
      return 0;
    });
  }

  #buildHeader(theader?: Header): Buffer {
    // This method converts and `Header` object into a buffer without encryption

    const header = theader || Object.assign({}, this.#header, { totalSize: this.#state.byteLength });
    const headerBuffer = Buffer.alloc(HEADER_LENGTH);

    for(let i = 0; i < MAGIC_HEADER.length; i++) {
      headerBuffer[i] = MAGIC_HEADER[i];
    }

    const rowsLengthArray = unwrap( optionalDefined( jsonSafeStringify(header.rowsLength) ) );
    const objectSchema = unwrap( optionalDefined( jsonSafeStringify(header.schemaHeader) ) );

    const rowsLength = Buffer.byteLength(rowsLengthArray);
    const schemaHeaderLength = Buffer.byteLength(objectSchema);

    headerBuffer.writeUint32LE(header.totalSize, 4); // totalSize
    headerBuffer.writeUint32LE(rowsLength, 8); // rowsObjectLength
    headerBuffer.writeUint32LE(schemaHeaderLength, 12); // objectSchemaLength

    headerBuffer.write(rowsLengthArray, 16, 'utf8');
    headerBuffer.write(objectSchema, 16 + rowsLength, 'utf8');

    return headerBuffer;
  }

  #getRowOffset(rowIndex: number): number {
    // Calculate the offset in the file where the row data will be written.
    let offset = HEADER_LENGTH; // Start after the header

    for(let i = 0; i < rowIndex; i++) {
      offset += this.#header.rowsLength[i]; // Add the lengths of previous rows
    }

    return offset; // Return the calculated offset
  }

  async #writeRow(rowIndex: number, tree: RedBlackTree<[string, unknown]>): Promise<void> {
    let header = this.#buildHeader();

    // eslint-disable-next-line no-extra-boolean-cast
    if(!!this.#encryptionKey) {
      const encrypted = await encryptIfKey(header, this.#encryptionKey);

      if(!Array.isArray(encrypted)) {
        throw new Exception(`Failed to execute encryption routine for table '${this.#file.filename}'`, 'ERR_UNKNOWN_ERROR');
      }

      header = encrypted[1];
    }

    // TODO: implement journaling system to make secure disk operations

    await this.#file.write(header, 0);

    // TODO: write rows in the file
    throw new IOStream.Exception.NotImplemented('Table#writeRow()', [rowIndex, tree]);
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

      let rowBuffer = Buffer.alloc(this.#header.rowsLength[rowIndex]);
      await this.#file.read(rowBuffer, this.#header.rowsLength[rowIndex], this.#getRowOffset(rowIndex) + this.#header.rowsLength[rowIndex]);

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
    throw new IOStream.Exception.NotImplemented('Table#insert()', [obj]);
  }

  public async close(): Promise<void> {
    if(this.#state.closed) return;

    this.#diskFlushQueue.pause();
    this.#diskFlushQueue.dispose();

    await this.#file.close();
    this.#cachedRows.root = null!;
    
    this.#header.rowsLength = [];
    this.#header.schemaHeader = [];

    this.#state.byteLength = 0;
    this.#state.ioBlocked = true;
    this.#state.closed = true;
  }
}

export default Table;
