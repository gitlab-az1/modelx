import type { BinaryHolder } from './types';


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
