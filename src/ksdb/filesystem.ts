import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import math from 'next-math';
import { delay } from '@ts-overflow/async/core';

import { Exception } from '../@internals/errors';
import { Either, left, right } from '../@internals/either';
import { mask as maskBuffer, unmask as unmaskBuffer } from '../@internals/buffer';


export interface DuplexFileTransformer {
  readonly __kind: 'duplex';
  transform(input: Buffer, length?: number, offset?: number): Buffer | Promise<Buffer>;
}

export interface SingleWayFileTransformer {
  readonly __kind: 'single-way';
  encode(input: Buffer, length?: number, offset?: number): Buffer | Promise<Buffer>;
  decode(input: Buffer, length?: number, offset?: number): Buffer | Promise<Buffer>;
}


export class BinaryTransformer implements SingleWayFileTransformer {
  readonly #bufferMask?: Buffer | Uint8Array;

  public constructor(mask?: Buffer | Uint8Array) {
    if(!!mask && !Buffer.isBuffer(mask) && !(mask instanceof Uint8Array)) {
      throw new Exception('The mask for binary files should be a buffer or Uint8Array', 'ERR_INVALID_ARGUMENT');
    }

    this.#bufferMask = mask;

    if(!process.env.NO_BUFFER_UTILS) {
      process.env.NO_BUFFER_UTILS = '1';
    }
  }

  public get __kind(): 'single-way' {
    return 'single-way' as const;
  }

  public encode(input: Buffer | Uint8Array): Buffer {
    const d = Buffer.isBuffer(input) ? input : Buffer.from(input);
    let out: Buffer;

    // eslint-disable-next-line no-extra-boolean-cast
    if(!!this.#bufferMask) {
      out = Buffer.alloc(d.length);
      maskBuffer(d, this.#bufferMask as Buffer, out, 0, d.length);
    } else {
      out = d;
    }

    return Buffer.from(out.toString('binary'));
  }

  public decode(input: Buffer): Buffer {
    const d = Buffer.from(input.toString(), 'binary');

    // eslint-disable-next-line no-extra-boolean-cast
    if(!!this.#bufferMask) {
      unmaskBuffer(d, this.#bufferMask as Buffer);
    }

    return d;
  }
}

export class ZlibTransformer implements DuplexFileTransformer {
  public get __kind(): 'duplex' {
    return 'duplex' as const;
  }

  /**
   * Transforms the input buffer by inflating or deflating it.
   * Automatically determines if the buffer is compressed or not.
   *
   * @param input - The buffer to transform.
   * @param length - (Optional) Length of the input to process.
   * @param offset - (Optional) Offset in the buffer to start processing.
   * @returns A transformed buffer or a Promise that resolves to one.
   */
  public async transform(input: Buffer, length?: number, offset?: number): Promise<Buffer> {
    const data = input.subarray(offset || 0, (offset || 0) + (length || input.length));

    try {
      // Attempt to deflate (compress) the data.
      const deflated = await new Promise<Buffer>((resolve, reject) => {
        zlib.deflate(data, (err, result) => {
          if(!err) return resolve(result);
          reject(err);
        });
      });

      return deflated;
    } catch(deflateErr: any) {
      // If deflation fails, attempt to inflate (decompress).
      try {
        const inflated = await new Promise<Buffer>((resolve, reject) => {
          zlib.inflate(data, (err, result) => {
            if(!err) return resolve(result);
            reject(err);
          });
        });

        return inflated;
      } catch(inflateErr: any) {
        // Throw an error if both transformations fail.
        throw new Exception(`Failed to transform data: deflate error - ${deflateErr.message}, inflate error - ${inflateErr.message}`, 'ERR_UNKNOWN_ERROR');
      }
    }
  }
}


export type OpenMode =
  | 'a'
  | 'ax'
  | 'a+'
  | 'ax+'
  | 'as'
  | 'as+'
  | 'r'
  | 'rs'
  | 'r+'
  | 'rs+'
  | 'w'
  | 'wx'
  | 'w+'
  | 'wx+';

export type FileOpenOptions = {
  lock?: boolean;
  autoClose?: boolean;
  waitLockTimeout?: number;
  transformers?: readonly (SingleWayFileTransformer | DuplexFileTransformer)[];
}

export class File {
  public static async open(
    filepath: fs.PathLike,
    mode: OpenMode | number,
    options?: FileOpenOptions // eslint-disable-line comma-dangle
  ): Promise<Either<Exception, File>> {
    const dirname = path.dirname(filepath.toString());
    const filename = path.basename(filepath.toString());
    const lockname = `.${filename.replace(/^\./, '')}.lock`;

    const lockPath = path.join(dirname, lockname);

    if(filepath.toString().startsWith('../') || filepath.toString().startsWith('./')) {
      filepath = path.resolve(filepath.toString());
    }

    try {
      if(fs.existsSync(lockPath)) {
        const timeout = options?.waitLockTimeout ?? 5000; // Default wait timeout
        const startTime = Date.now();

        while(fs.existsSync(lockPath)) {
          if(Date.now() - startTime >= timeout) {
            throw new Exception(`Timeout exceded waiting for '${filename}'`, 'ERR_RESOURCE_LOCKED');
          }

          await delay(250);
        }
      }

      try {
        if(options?.lock !== false) {
          try {
            await fs.promises.writeFile(lockPath, Buffer.alloc(2));
          } catch (err: any) {
            throw new Exception(`Failed to create lock for '${filename}': ${err.message || err}`, 'ERR_UNKNOWN_ERROR');
          }
        }
        
        const nativeHandler = await fs.promises.open(filepath, mode);
        const stats = await fs.promises.stat(filepath);
  
        return right(new File(nativeHandler,
          dirname, filename, lockname, stats, options));
      } catch(err: any) {
        if(fs.existsSync(lockPath)) {
          await fs.promises.unlink(lockPath);
        }

        throw err;
      }
    } catch (err: any) {
      let e = err;

      if(!(err instanceof Exception)) {
        e = new Exception((err.message || err) || `An unknown error was occured while opening '${filename}'`, 'ERR_UNKNOWN_ERROR', { _inner: err });
      }

      return left(e);
    }
  }

  readonly #dirname: string;
  readonly #filename: string;
  readonly #lockPath: string;

  readonly #previousStats: fs.Stats;
  readonly #handler: fs.promises.FileHandle;
  #transformers: (SingleWayFileTransformer | DuplexFileTransformer)[];

  #byteLength: number;
  #closed: boolean;

  private constructor(
    _handler: fs.promises.FileHandle,
    _dirname: string,
    _filename: string,
    _lockname: string,
    _stats: fs.Stats,
    _options?: FileOpenOptions // eslint-disable-line comma-dangle
  ) {
    this.#handler = _handler;

    this.#dirname = _dirname;
    this.#filename = _filename;
    this.#lockPath = path.join(_dirname, _lockname);

    this.#closed = false;
    this.#previousStats = _stats;
    this.#byteLength = _stats.size;
    this.#transformers = _options?.transformers && Array.isArray(_options?.transformers) ? [ ..._options.transformers ] : [];

    if(_options?.autoClose) {
      process.on('beforeExit', async () => {
        await this.close();
      });
    }
  }

  public get filename(): string {
    return this.#filename.slice(0);
  }

  public get dirname(): string {
    return this.#dirname.slice(0);
  }

  public get beforeOpenStats(): fs.Stats {
    return this.#previousStats;
  }

  public get byteLength(): number {
    return this.#byteLength;
  }

  public pushTransformer(transformer: SingleWayFileTransformer | DuplexFileTransformer): void {
    this.#transformers.push(transformer);
  }

  public removeTransformer(transformer: SingleWayFileTransformer | DuplexFileTransformer): boolean {
    const index = this.#transformers.findIndex(item => item === transformer);

    if(index > -1) {
      this.#transformers.splice(index, 1);
    }

    return index >= 0;
  }

  public async append(data: Buffer): Promise<number> {
    let dataToWrite = data;

    // Apply transformers to the data before appending if any are present
    if(this.#transformers.length > 0) {
      await Promise.all(
        this.#transformers.map(async transformer => {
          if(transformer.__kind === 'single-way') {
            dataToWrite = await transformer.encode(dataToWrite);
          } else if(transformer.__kind === 'duplex') {
            dataToWrite = await transformer.transform(dataToWrite);
          }
        }) // eslint-disable-line comma-dangle
      );
    }

    // Append data to the end of the file (write in append mode)
    const { bytesWritten } = await this.#handler.write(dataToWrite, this.#byteLength, dataToWrite.length);
    this.#byteLength += bytesWritten;  // Update byte length of the file after appending

    return bytesWritten;
  }

  public appendFile(data: Buffer): Promise<void> {
    return this.#handler.appendFile(data);
  }

  public read(buffer: Buffer, length?: number, offset?: number): Promise<void>;
  public read(length?: number, offset?: number): Promise<Buffer>;
  public async read(
    bufferOrLength?: Buffer | number,
    lengthOrOffset?: number,
    offset?: number // eslint-disable-line comma-dangle
  ): Promise<Buffer | void> {
    if(Buffer.isBuffer(bufferOrLength)) {
      // Overload: Buffer provided, just fill it
      const buffer = bufferOrLength;
      const length = lengthOrOffset ?? buffer.length;
      const position = offset ?? null;

      const { bytesRead } = await this.#handler.read(buffer, 0, length, position);

      if(this.#transformers.length > 0) {
        let transformedBuffer = buffer.subarray(0, bytesRead);

        await Promise.all(
          this.#transformers.map(async transformer => {
            if(transformer.__kind === 'single-way') {
              transformedBuffer = await transformer.decode(transformedBuffer);
            } else if(transformer.__kind === 'duplex') {
              transformedBuffer = await transformer.transform(transformedBuffer);
            }
          }) // eslint-disable-line comma-dangle
        );

        transformedBuffer.copy(buffer, 0);
      }
    } else {
      // Overload: Read into a new buffer
      const length = bufferOrLength ?? 1024; // Default length is 1KB
      const position = lengthOrOffset ?? null;

      const buffer = Buffer.alloc(length);
      const { bytesRead } = await this.#handler.read(buffer, 0, length, position);

      let resultBuffer = buffer.subarray(0, bytesRead);

      if(this.#transformers.length > 0) {
        await Promise.all(
          this.#transformers.map(async transformer => {
            if(transformer.__kind === 'single-way') {
              resultBuffer = await transformer.decode(resultBuffer);
            } else if(transformer.__kind === 'duplex') {
              resultBuffer = await transformer.transform(resultBuffer);
            }
          }) // eslint-disable-line comma-dangle
        );
      }

      return resultBuffer;
    }
  }

  public async write(data: Buffer, offset?: number): Promise<number> {
    let dataToWrite = data;

    if(this.#transformers.length > 0) {
      await Promise.all(
        this.#transformers.map(async transformer => {
          if(transformer.__kind === 'single-way') {
            dataToWrite = await transformer.encode(dataToWrite);
          } else if(transformer.__kind === 'duplex') {
            dataToWrite = await transformer.transform(dataToWrite);
          }
        }) // eslint-disable-line comma-dangle
      );
    }

    const { bytesWritten } = await this.#handler.write(dataToWrite, 0, dataToWrite.length, offset);
    this.#byteLength = math.max(this.#byteLength, (offset || 0) + bytesWritten);

    return bytesWritten;
  }

  public async truncate(length?: number): Promise<void> {
    await this.#handler.truncate(length || 0);
    this.#byteLength = length || 0;
  }

  public async close(): Promise<void> {
    if(this.#closed) return;
    await this.#handler.close();

    if(fs.existsSync(this.#lockPath)) {
      await fs.promises.unlink(this.#lockPath);
    }

    this.#closed = true;
  }

  public stats(): Promise<fs.Stats> {
    return this.#handler.stat({ bigint: false });
  }

  public bigIntStats(): Promise<fs.BigIntStats> {
    return this.#handler.stat({ bigint: true });
  }

  public readStream(options?: fs.promises.CreateReadStreamOptions): fs.ReadStream {
    return this.#handler.createReadStream(options);
  }

  public writeStream(options?: fs.promises.CreateWriteStreamOptions): fs.WriteStream {
    return this.#handler.createWriteStream(options);
  }

  public webReadableStream(options?: fs.promises.ReadableWebStreamOptions): ReadableStream {
    return this.#handler.readableWebStream(options);
  }
}
