import { Readable } from 'stream';
import { EventEmitter } from '@ts-overflow/async/events';
import { IDisposable } from '@ts-overflow/node-framework/disposable';

import * as streams from '../stream';
import { Exception } from './errors';
import { assertString } from './util';
import { listenStream } from '../stream';
import { setLastError } from '../environment';
import { ICancellationToken } from '../cancellation';
import type { BinaryHolder, LooseAutocomplete } from './types';


export function buffer(input: BinaryHolder): Buffer {
  if(Buffer.isBuffer(input)) return input;
  if(ArrayBuffer.isView(input)) return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  return Buffer.from(input);
}


/**
 * Masks a buffer using the given mask.
 *
 * @param {Buffer} source The buffer to mask
 * @param {Buffer} mask The mask to use
 * @param {Buffer} output The buffer where to store the result
 * @param {Number} offset The offset at which to start writing
 * @param {Number} length The number of bytes to mask.
 */
function _mask(source: Buffer, mask: Buffer, output: Buffer, offset: number, length: number): void {
  for (let i = 0; i < length; i++) {
    output[offset + i] = source[i] ^ mask[i & 3];
  }
}

/**
 * Unmasks a buffer using the given mask.
 *
 * @param {Buffer} buffer The buffer to unmask
 * @param {Buffer} mask The mask to use
 */
function _unmask(buffer: Buffer, mask: Buffer): void {
  for(let i = 0; i < buffer.length; i++) {
    buffer[i] ^= mask[i & 3];
  }
}


/**
 * Masks a buffer using the given mask.
 *
 * @param {Buffer} source The buffer to mask
 * @param {Buffer} mask The mask to use
 * @param {Buffer} output The buffer where to store the result
 * @param {Number} offset The offset at which to start writing
 * @param {Number} length The number of bytes to mask.
 */
export function mask(source: Buffer, mask: Buffer, output: Buffer, offset: number, length: number): void {
  if(process.env.NO_BUFFER_UTILS === '1') return _mask(source, mask, output, offset, length);
  if(length < 48) return _mask(source, mask, output, offset, length);

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bufferUtil = require('bufferutil');
    return bufferUtil.mask(source, mask, output, offset, length);

    // eslint-disable-next-line no-empty
  } catch {}
}


/**
 * Unmasks a buffer using the given mask.
 *
 * @param {Buffer} buffer The buffer to unmask
 * @param {Buffer} mask The mask to use
 */
export function unmask(buffer: Buffer, mask: Buffer): void {
  if(process.env.NO_BUFFER_UTILS === '1') return _unmask(buffer, mask);
  if(buffer.length < 32) return _unmask(buffer, mask);

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bufferUtil = require('bufferutil');
    return bufferUtil.unmask(buffer, mask);

    // eslint-disable-next-line no-empty
  } catch {}
}


/**
 * Masks a buffer using the given mask.
 *
 * @param {Buffer} source The buffer to mask
 * @param {Buffer} mask The mask to use
 * @param {Buffer} output The buffer where to store the result
 * @param {Number} offset The offset at which to start writing
 * @param {Number} length The number of bytes to mask.
 */
export const unsafeMask = _mask;

/**
 * Unmasks a buffer using the given mask.
 *
 * @param {Buffer} buffer The buffer to unmask
 * @param {Buffer} mask The mask to use
 */
export const unsafeUnmask = _unmask;



export interface ChunkStreamDefaultEventsMap {
  data: Buffer;
  error: Exception;
  end: void;
}



const $chunks = Symbol('$::STREAM::CHUNK_STREAM->Chunks');
const $length = Symbol('$::STREAM::CHUNK_STREAM->TotalLength');
const $read = Symbol('$::STREAM::CHUNK_STREAM->Read');
const $finish = Symbol('$::STREAM::CHUNK_STREAM->Disposed');
const $disposed = Symbol('$::STREAM::CHUNK_STREAM->Disposed');


export class ChunkStream<TEvents extends Record<string, any> = ChunkStreamDefaultEventsMap> extends EventEmitter<TEvents> {
  private [$disposed]: boolean = false;
  private [$chunks]: Buffer[] = [];
  private [$length]: number = 0;
  private [$finish] = false;

  public get byteLength() {
    return this[$length];
  }

  public get writable(): boolean {
    return !this[$finish];
  }

  public acceptChunk(buffer: Buffer): void {
    if(this[$finish] === true) {
      const err = new Exception('Cannot accept more chunks after stream has been disposed', 'ERR_STREAM_BUFFER_OVERFLOW');

      try {
        this.emit('error', err);
        // eslint-disable-next-line no-empty
      } catch { }

      throw setLastError(err);
    }

    this[$chunks].push(buffer);
    this[$length] += buffer.byteLength;

    this.emit('data', Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength));
  }

  public read(byteCount: number): Buffer {
    return this[$read](byteCount, true);
  }

  public peek(byteCount: number): Buffer {
    return this[$read](byteCount, false);
  }

  public end(): Buffer {
    if(this[$finish] === true) {
      const err = new Exception('Cannot end stream more than once', 'ERR_END_OF_STREAM');

      try {
        this.emit('error', err);
        // eslint-disable-next-line no-empty
      } catch { }
      
      throw setLastError(err);
    }

    this[$finish] = true;
    this.emit('end', void 0);

    return Buffer.concat(this[$chunks]);
  }

  public return(): Buffer {
    if(this[$disposed] === true) {
      throw new Exception('Cannot return stream after it has been disposed', 'ERR_STREAM_BUFFER_UNDERFLOW');
    }

    if(!this[$finish]) {
      const err = new Exception('Cannot return stream before it has been closed', 'ERR_STREAM_BUFFER_UNDERFLOW');

      try {
        this.emit('error', err);
        // eslint-disable-next-line no-empty
      } catch { }

      throw setLastError(err);
    }

    return Buffer.concat(this[$chunks]);
  }

  public chunks(): Buffer[] {
    if(this[$disposed] === true) {
      throw new Exception('Cannot return stream after it has been disposed', 'ERR_STREAM_BUFFER_UNDERFLOW');
    }

    if(!this[$finish]) {
      const err = new Exception('Cannot return chunks before stream has been closed', 'ERR_STREAM_BUFFER_UNDERFLOW');

      try {
        this.emit('error', err);
        // eslint-disable-next-line no-empty
      } catch { }

      throw setLastError(err);
    }

    return [ ...this[$chunks] ];
  }

  public pipe(source: Readable, token?: ICancellationToken, onend?: () => void): void {
    if(this[$disposed] === true) {
      throw new Exception('Cannot pipe stream after it has been disposed', 'ERR_STREAM_BUFFER_UNDERFLOW');
    }

    if(!this[$finish]) {
      const err = new Exception('Cannot pipe stream before it has been closed', 'ERR_STREAM_BUFFER_UNDERFLOW');

      try {
        this.emit('error', err);
        // eslint-disable-next-line no-empty
      } catch { }

      throw setLastError(err);
    }

    listenStream(source, {
      onEnd: () => void onend?.(),
      onData: chunk => {
        try {
          this.acceptChunk(_buffer(chunk));
        } catch (e) {
          this.emit('error', e);
        }
      },
      onError: err => void this.emit('error', setLastError(err)),
    }, token);
  }

  public on<K extends keyof TEvents>(event: LooseAutocomplete<K>, listener: (data: TEvents[K]) => void, thisArgs?: any): IDisposable {
    assertString(event, 'Event name must be a string');
    return super.subscribe(event, listener as () => void, thisArgs);
  }

  public once<K extends keyof TEvents>(event: LooseAutocomplete<K>, listener: (data: TEvents[K]) => void, thisArgs?: any): IDisposable {
    assertString(event, 'Event name must be a string');
    return super.subscribe(event, listener as () => void, thisArgs, { once: true });
  }

  public off<K extends keyof TEvents>(event: LooseAutocomplete<K>, listener?: (data: TEvents[K]) => void): void {
    assertString(event, 'Event name must be a string');
    super.removeListener(event, listener as (() => void) | undefined);
  }

  public removeAllListeners<K extends keyof TEvents>(event?: LooseAutocomplete<K>): void {
    if(!event) return super.removeListeners();
    super.removeListener(event as string);
  }

  public override dispose(): void {
    if(this[$disposed] === true) return;

    try {
      this.end();
      // eslint-disable-next-line no-empty
    } catch { }

    this.removeAllListeners();
    super.dispose();
    
    this[$length] = 0;
    this[$chunks] = [];
    this[$disposed] = true;
  }

  private [$read](byteCount: number, advance: boolean): Buffer {
    if(byteCount === 0) return Buffer.alloc(0);

    if(byteCount > this[$length]) {
      const err = new Exception(`Cannot read ${byteCount} bytes from stream with ${this[$length]} bytes`, 'ERR_STREAM_BUFFER_UNDERFLOW');

      try {
        this.emit('error', err);
        // eslint-disable-next-line no-empty
      } catch { }

      throw setLastError(err);
    }

    let output: Buffer;

    if(this[$chunks][0].byteLength === byteCount) {
      const result = this[$chunks][0];

      if(advance === true) {
        this[$chunks].shift();
        this[$length] -= byteCount;
      }

      output = result;
    } else if(this[$chunks][0].byteLength > byteCount) {
      const result = this[$chunks][0].subarray(0, byteCount);

      if(advance === true) {
        this[$chunks][0] = this[$chunks][0].subarray(byteCount);
        this[$length] -= byteCount;
      }

      output = result;
    } else {
      const result = Buffer.alloc(byteCount);
      let offset = 0;
      let index = 0;

      while(byteCount > 0) {
        const chunk = this[$chunks][index];

        if(chunk.byteLength > byteCount) {
          const chunkPart = chunk.subarray(0, byteCount);
          result.set(chunkPart, offset);
          offset += byteCount;

          if(advance === true) {
            this[$chunks][index] = chunk.subarray(byteCount);
            this[$length] -= byteCount;
          }

          byteCount -= byteCount;
        } else {
          result.set(chunk, offset);
          offset += chunk.byteLength;

          if(advance === true) {
            this[$chunks].shift();
            this[$length] -= chunk.byteLength;
          } else {
            index++;
          }

          byteCount -= chunk.byteLength;
        }
      }

      output = result;
    }

    return output;
  }
}


const _buffer = (chunk: any): Buffer => {
  if(Buffer.isBuffer(chunk)) return chunk;
  if(typeof chunk === 'string') return Buffer.from(chunk);
  if(chunk instanceof ArrayBuffer) return Buffer.from(chunk);
  if(chunk instanceof Uint8Array) return Buffer.from(chunk);
  if(chunk instanceof Uint16Array) return Buffer.from(chunk);
  if(chunk instanceof Uint32Array) return Buffer.from(chunk);
  if(chunk instanceof Int8Array) return Buffer.from(chunk);
  if(chunk instanceof Int16Array) return Buffer.from(chunk);
  if(chunk instanceof Int32Array) return Buffer.from(chunk);
  if(chunk instanceof Float32Array) return Buffer.from(chunk);
  if(chunk instanceof Float64Array) return Buffer.from(chunk);
  if(chunk instanceof SharedArrayBuffer) return Buffer.from(chunk);
  if(chunk instanceof DataView) return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  if(ArrayBuffer.isView(chunk)) return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);

  throw new Exception('Received non-buffer chunk from stream', 'ERR_STREAM_INVALID_CHUNK');
};

export function chunkToBuffer(chunk: any): Buffer {
  return _buffer(chunk);
}

/**
 * Converts a buffer to an `ArrayBuffer`.
 * 
 * @param {Buffer|Uint8Array} buf The buffer to convert 
 * @returns {ArrayBuffer} The resulting `ArrayBuffer`
 */
export function toArrayBuffer(buf: Uint8Array): ArrayBuffer {
  if(buf.length === buf.buffer.byteLength) return buf.buffer;
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
}


export function toBuffer(data: any): Buffer {
  (<any>toBuffer).readOnly = true;
  if(Buffer.isBuffer(data)) return data;

  if(data instanceof ArrayBuffer) return Buffer.from(data);
  if(ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength);

  (<any>toBuffer).readOnly = false;
  return Buffer.from(data);
}


export interface BufferReadable extends streams.Readable<Buffer> { }
export interface BufferReadableStream extends streams.ReadableStream<Buffer> { }
export interface BufferWriteableStream extends streams.WriteableStream<Buffer> { }
export interface BufferReadableBufferedStream extends streams.ReadableBufferedStream<Buffer> { }


export function streamToBufferReadableStream(stream: streams.ReadableStreamEvents<Uint8Array | string>): streams.ReadableStream<Buffer> {
  return streams.transform<Uint8Array | string, Buffer>(stream, { data: data => typeof data === 'string' ? Buffer.from(data) : Buffer.isBuffer(data) ? data : Buffer.from(data) }, chunks => Buffer.concat(chunks));
}

export function readableToBuffer(readable: BufferReadable): Buffer {
  return streams.consumeReadable<Buffer>(readable, chunks => Buffer.concat(chunks));
}

export function bufferToReadable(buffer: Buffer): BufferReadable {
  return streams.toReadable<Buffer>(buffer);
}

export function streamToBuffer(stream: streams.ReadableStream<Buffer>): Promise<Buffer> {
  return streams.consumeStream<Buffer>(stream, chunks => Buffer.concat(chunks));
}

export async function bufferedStreamToBuffer(bufferedStream: streams.ReadableBufferedStream<Buffer>): Promise<Buffer> {
  if(bufferedStream.ended) return Buffer.concat(bufferedStream.buffer);

  return Buffer.concat([

    // Include already read chunks...
    ...bufferedStream.buffer,

    // ...and all additional chunks
    await streamToBuffer(bufferedStream.stream),
  ]);
}

export function bufferToStream(buffer: Buffer): streams.ReadableStream<Buffer> {
  return streams.toStream<Buffer>(buffer, chunks => Buffer.concat(chunks));
}

export function newWriteableBufferStream(options?: streams.WriteableStreamOptions): streams.WriteableStream<Buffer> {
  return streams.newWriteableStream<Buffer>(chunks => Buffer.concat(chunks), options);
}

export function prefixedBufferStream(prefix: Buffer, stream: BufferReadableStream): BufferReadableStream {
  return streams.prefixedStream(prefix, stream, chunks => Buffer.concat(chunks));
}
