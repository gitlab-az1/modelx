import fs from 'fs';
import path from 'path';
import { delay } from '@ts-overflow/async/core';

import IOStream from '../io';
import { ensureDir } from '../fs';
import { Exception } from '../@internals/errors';
import { optionalDefined, unwrap } from '../option';
import { chunkToBuffer } from '../@internals/buffer';
import { decryptIfKey, encryptIfKey } from './crypto';
import { BufferMaskTransformer, File } from './filesystem';
import { Either, left, right } from '../@internals/either';
import { RedBlackTree, upsert, lookup } from '../btree/redBlackTree';
import { jsonSafeParser, jsonSafeStringify } from '../@internals/json';


const BUFFER_MASK = Buffer.from('5435bf19b176', 'hex');
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
  headerLength: number;
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
  T['nullable'] extends true ? V | null | undefined : V
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


const enum FlushOperation {
  WriteInsertion,
  WriteUpdate,
  WriteDeletion,
}


function bTreeComparator(a: [string, unknown], b: [string, unknown]): 1 | 0 | -1 {
  if(a[0] > b[0]) return 1;
  if(a[0] < b[0]) return -1;
  return 0;
}


export type TableOpenProps = {
  filepath: string;
  paranoidChecksMode?: boolean;
  srictValidateChecksums?: boolean;
  encryptionKey?: string | Uint8Array | SharedArrayBuffer | ArrayBuffer;
};

export class Table<T extends object> {
  static async #ParseHeader(header: Buffer, magic: Buffer, options: TableOpenProps): Promise<Header> {
    // This method parse the given Buffer object into a `Header` structure.
    //
    // Header (4096 or more bytes):
    // +---------------------------------------+
    // |         magic number (4 bytes)        | 
    // +---------------------------------------+
    // |        header length (4 bytes)        |
    // +---------------------------------------+
    // |       total data size (4 bytes)       |
    // +---------------------------------------+
    // | byte length of `rowsLength` (4 bytes) |
    // +---------------------------------------+
    // |   byte length of `schema` (4 bytes)   |
    // +---------------------------------------+
    // |         the `rowsLength` array        |
    // +---------------------------------------+
    // |           the `schema` array          |
    // +---------------------------------------+

    if(options.paranoidChecksMode !== false) {
      for(let i = 0; i < MAGIC_HEADER.length; i++) { 
        if(magic[i] !== MAGIC_HEADER[i]) {
          throw new Exception('Failed to parse database header', 'ERR_MAGIC_NUMBER_MISSMATCH');
        }
      }
    }

    // eslint-disable-next-line no-extra-boolean-cast
    if(!!options.encryptionKey) { // Decrypt the header buffer if a key is set
      const decrypted = await decryptIfKey(header, chunkToBuffer(options.encryptionKey));
  
      if(!Array.isArray(decrypted)) {
        throw new Exception(`Failed to execute decryption routine for table '${path.basename(options.filepath)}'`, 'ERR_UNKNOWN_ERROR');
      }
  
      header = decrypted[0];
    }
  
    const totalSize = header.readUint32LE(0); 
    const rowsObjectLength = header.readUint32LE(4); 
    const objectSchemaLength = header.readUint32LE(8); 
  
    const parsedSchemaHeader = jsonSafeParser<TableHeader[]>(header.subarray(12 + rowsObjectLength, 12 + rowsObjectLength + objectSchemaLength).toString('utf8'));
    const parsedLengthsObject = jsonSafeParser<number[]>(header.subarray(12, 12 + rowsObjectLength).toString('utf8'));

    if(parsedLengthsObject.isLeft()) {
      throw parsedLengthsObject.value;
    }

    if(parsedSchemaHeader.isLeft()) {
      throw parsedSchemaHeader.value;
    }

    return {
      totalSize,
      headerLength: header.byteLength,
      schemaHeader: parsedSchemaHeader.value,
      rowsLength: parsedLengthsObject.value,
    };
  }

  static async #CreateEmptyFile(options: TableOpenProps): Promise<void> {
    const left = Buffer.alloc(MAGIC_HEADER.length + 4);
    let header = Buffer.alloc(HEADER_LENGTH - (MAGIC_HEADER.length + 4));

    const emptyArray = Buffer.from(unwrap(optionalDefined(jsonSafeStringify([]))), 'utf8');
    const emptyArrayLength = emptyArray.byteLength;

    header.writeUint32LE(0, 0); // total data byte size
    header.writeUint32LE(emptyArrayLength, 4); // rows length (bytes)
    header.writeUint32LE(emptyArrayLength, 8); // schema length (bytes)

    // Write empty arrays to the header
    header.write(emptyArray.toString('utf8'), 12, 'utf8'); // rows array
    header.write(emptyArray.toString('utf8'), 12 + emptyArrayLength, 'utf8'); // schema array

    // Handle encryption if the key is provided
    if(options.encryptionKey) {
      const encrypted = await encryptIfKey(header, chunkToBuffer(options.encryptionKey));

      if(!Array.isArray(encrypted)) {
        throw new Exception(`Failed to execute encryption routine for table '${path.basename(options.filepath)}'`, 'ERR_UNKNOWN_ERROR');
      }

      header = encrypted[1];
    }

    for(let i = 0; i < MAGIC_HEADER.length; i++) {
      left[i] = MAGIC_HEADER[i];
    }
    
    left.writeUint32LE(header.byteLength, MAGIC_HEADER.length);
    
    // Request an file descriptor for table's filename in write mode
    const file = await File.open(options.filepath, 'w+', { lock: true });

    if(file.isLeft()) {
      throw file.value;
    }

    file.value.pushTransformer(new BufferMaskTransformer(BUFFER_MASK));
    // file.value.pushTransformer(new BinaryTransformer(BUFFER_MASK)); -- Removed due to issue (#1) // Prepare file handler to encode/decode binary files with mask `BUFFER_MASK`
    // file.value.pushTransformer(new ZlibTransformer()); -- Skipping compression in this phase

    try {
      // Writes the header to the file
      await file.value.write(Buffer.concat([left, header]), 0);
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

      if(!fs.existsSync(options.filepath)) { // Creates a new empty file if not exists
        await this.#CreateEmptyFile(options);
      }
      
      // Request an file descriptor to table's file in read/write mode
      const file = await File.open(options.filepath, 'r+', { lock: true });

      if(file.isLeft()) {
        throw file.value;
      }

      try {
        // file.value.pushTransformer(new ZlibTransformer()); -- Skipping compression in this phase
        // file.value.pushTransformer(new BinaryTransformer(BUFFER_MASK)); -- Removed due to issue (#1) // Prepare file handler to encode/decode binary files with `BUFFER_MASK`
        file.value.pushTransformer(new BufferMaskTransformer(BUFFER_MASK));

        const leftBuffer = Buffer.alloc(MAGIC_HEADER.length + 4);
        await file.value.read(leftBuffer, leftBuffer.byteLength, 0);

        const headerLength = leftBuffer.readUint32LE(MAGIC_HEADER.length);
        const headerBuffer = Buffer.alloc(headerLength);

        await file.value.read(headerBuffer, Math.min(headerLength, file.value.byteLength), MAGIC_HEADER.length + 4);
        const header = await this.#ParseHeader(headerBuffer, leftBuffer.subarray(0, MAGIC_HEADER.length), options);

        // Resolve the promise with a new instance of `Table` as `Right`
        return right(new Table(file.value, header, options.encryptionKey));
      } catch (err) { // Ensure the file descriptor will be closed and re-throw the exception if some error occurs
        await file.value.close();
        throw err;
      }
    } catch (error: any) {
      let e = error;

      if(!(error instanceof Exception)) {
        e = new Exception(error.message || error || `An unknown error was occured while opening '${path.basename(options.filepath)}'`, 'ERR_UNKNOWN_ERROR', {
          _inner: error,
          _stackTrace: error.stack,
        });
      }

      // Reject the promise with the error with `Left`
      return left(e);
    }
  }

  static #ReviveValue<THeader extends TableHeader = TableHeader>(header: THeader, value: any): InferRuntimeValueFromHeader<THeader> {
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

  readonly #File: File;
  readonly #Header: Header;
  #CachedRows: RedBlackTree<[ number, RedBlackTree<[string, unknown]> ]>;
  #PendingDiskFlushes: { rowIndex: number; tree: RedBlackTree<[string, unknown]>; readonly op: FlushOperation }[];

  #EncryptionKey?: Buffer;

  readonly #State: {
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

    this.#File = _file;
    this.#Header = _header;
    this.#PendingDiskFlushes = [];
    this.#CachedRows = new RedBlackTree();
    // eslint-disable-next-line no-extra-boolean-cast
    this.#EncryptionKey = !!_ek ? chunkToBuffer(_ek) : undefined;
    
    this.#State = {
      closed: false,
      ioBlocked: false,
      byteLength: _header.totalSize,
    };
  }

  #GetBalancedTreeFromCache(rowIndex: number): RedBlackTree<[string, unknown]> | null {
    // Check if `rowIndex` already have an Red-Black tree cached in memory
    // and if exists, we don't need to read the file again to fetch this data, we're use the cache instead

    const node = lookup<any>(this.#CachedRows, [rowIndex], (a, b) => {
      if(a[0] > b[0]) return 1;
      if(a[0] < b[0]) return -1;
      return 0;
    });

    return node ? node.content[1] : null;
  }

  #CacheBalancedTree(rowIndex: number, tree: RedBlackTree<[string, unknown]>): void {
    // Sets an Red-Black tree into the cache for `rowIndex`

    upsert(this.#CachedRows, [rowIndex, tree], (a, b) => {
      if(a[0] > b[0]) return 1;
      if(a[0] < b[0]) return -1;
      return 0;
    });
  }

  async #BuildHeader(theader?: Header): Promise<Buffer> {
    // This method converts and `Header` object into a buffer without encryption

    const header = theader || Object.assign({}, this.#Header, { totalSize: this.#State.byteLength });

    const leftBuffer = Buffer.alloc(MAGIC_HEADER.length + 4);
    let headerBuffer = Buffer.alloc(HEADER_LENGTH - (MAGIC_HEADER.length + 4));

    for(let i = 0; i < MAGIC_HEADER.length; i++) {
      leftBuffer[i] = MAGIC_HEADER[i];
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

    // eslint-disable-next-line no-extra-boolean-cast
    if(!!this.#EncryptionKey) {
      const encrypted = await encryptIfKey(headerBuffer, this.#EncryptionKey);

      if(!Array.isArray(encrypted)) {
        throw new Exception(`Failed to execute encryption routine for table '${this.#File.filename}'`, 'ERR_UNKNOWN_ERROR');
      }

      headerBuffer = encrypted[1];
    }

    leftBuffer.writeUInt32LE(headerBuffer.byteLength, MAGIC_HEADER.length);
    return Buffer.concat([leftBuffer, headerBuffer]);
  }

  #GetRowOffset(rowIndex: number): number {
    // Calculate the offset in the file where the row data will be written.
    let offset = HEADER_LENGTH; // Start after the header

    for(let i = 0; i < rowIndex; i++) {
      offset += this.#Header.rowsLength[i]; // Add the lengths of previous rows
    }

    return offset; // Return the calculated offset
  }

  async #WriteRow(rowIndex: number, tree: RedBlackTree<[string, unknown]>): Promise<void> {
    throw new IOStream.Exception.NotImplemented('Table#writeRow()', [rowIndex, tree]);
    const header = await this.#BuildHeader();

    // TODO: implement journaling system to make secure disk operations

    await this.#File.write(header, 0);

    // TODO: write rows in the file
  }

  // @ts-expect-error The method Table#readRow() is never called
  async #ReadRow(rowIndex: number, waitTimeout: number = 4000): Promise<RedBlackTree<[string, unknown]>> {
    const cached = this.#GetBalancedTreeFromCache(rowIndex);
    if(cached) return cached;

    if(this.#State.ioBlocked) {
      const startTime = Date.now();
      
      while(this.#State.ioBlocked) {
        if(Date.now() - startTime >= waitTimeout) {
          throw new Exception('Timeout exceded waiting to read a table row', 'ERR_RESOURCE_LOCKED');
        }

        await delay(375);
      }
    }

    this.#State.ioBlocked = true;

    try {
      const balancedTree = new RedBlackTree<[string, unknown]>();

      let rowBuffer = Buffer.alloc(this.#Header.rowsLength[rowIndex]);
      await this.#File.read(rowBuffer, this.#Header.rowsLength[rowIndex], this.#GetRowOffset(rowIndex) + this.#Header.rowsLength[rowIndex]);

      // eslint-disable-next-line no-extra-boolean-cast
      if(!!this.#EncryptionKey) {
        const decrypted = await decryptIfKey(rowBuffer, this.#EncryptionKey);

        if(!Array.isArray(decrypted)) {
          throw new Exception(`Failed to execute decryption routine for table '${this.#File.filename}'`, 'ERR_UNKNOWN_ERROR');
        }

        rowBuffer = decrypted[0];
      }

      const parsedRow = jsonSafeParser<unknown[]>(rowBuffer.toString('utf8'));

      if(parsedRow.isLeft()) {
        throw parsedRow.value;
      }

      if(parsedRow.value.length !== this.#Header.schemaHeader.length) {
        throw new Exception('The row length not match with header fields', 'ERR_OUT_OF_BOUNDS');
      }

      for(let i = 0; i < parsedRow.value.length; i++) {
        const header = this.#Header.schemaHeader[i];
        upsert(balancedTree, [header.fieldName, Table.#ReviveValue(header, parsedRow.value[i])], bTreeComparator);
      }

      this.#CacheBalancedTree(rowIndex, balancedTree);
      return balancedTree;
    } finally {
      this.#State.ioBlocked = false;
    }
  }

  public byteLength(): number {
    if(this.#State.closed) return 0;
    return this.#State.byteLength;
  }

  public countRows(): number {
    if(this.#State.closed) return -1;
    return this.#Header.rowsLength.length;
  }

  public insert(obj: _SchemaObject<T>): void {
    const tree = new RedBlackTree<[string, unknown]>();

    for(const prop in obj) {
      upsert(tree, [prop, obj[prop]], bTreeComparator);
    }

    this.#PendingDiskFlushes.push({ rowIndex: this.#Header.rowsLength.length, tree, op: FlushOperation.WriteInsertion });
  }

  public async close(): Promise<void> {
    if(this.#State.closed) return;

    await this.#File.close();
    this.#CachedRows.root = null!;
    
    this.#Header.rowsLength = [];
    this.#Header.schemaHeader = [];

    this.#State.byteLength = 0;
    this.#State.ioBlocked = true;
    this.#State.closed = true;
  }
}

export default Table;
