import fs from 'fs';

import { Exception } from './@internals/errors';
import { mask as maskBuffer, unmask as unmaskBuffer } from './@internals/buffer';



/**
 * permission for files created by the app `[chmod 644]`.
 * 
 * permissions role:
 * `rw-r--r--`
 * 
 * `owner: read, write`
 * 
 * `group: read`
 * 
 * `others: read`
 * 
 * ```js
 * 0o644
 * ```
 * 
 * @example
 * ```js
 * import fs from 'node:fs'
 * fs.writeFileSync('new-file.txt', 'Hello World!', { mode: 0o644, encoding: 'utf-8' });
 * ```
 */
export const FILE_PERMISSION = 0o644;

/**
 * permission for folders created by the app `[chmod 755]`.
 * 
 * permissions role:
 * `rwxr-xr-x`
 * 
 * `owner: read, write, execute`
 * 
 * `group: read, execute`
 * 
 * `others: read, execute`
 * 
 * ```js
 * 0o755 
 * ```
 * 
 * @example
 * ```js
 * import fs from 'node:fs';
 * await fs.mkdirSync('new-folder', { mode: 0o755 });
 * ```
 */
export const FOLDER_PERMISSION = 0o755;


/**
 * Ensures that the directory exists. If the directory structure does not exist, it is created.
 * @param dirname
 */
export async function ensureDir(dirname: fs.PathLike): Promise<void> {
  if(!fs.existsSync(dirname)) return new Promise((resolve, reject) => {
    fs.mkdir(dirname, { recursive: true, mode: FOLDER_PERMISSION }, (err) => {
      if(err) return reject(err);
      resolve();
    });
  });

  const stats = await fs.promises.stat(dirname);

  if(!stats.isDirectory()) {
    await fs.promises.mkdir(dirname, { recursive: true, mode: FOLDER_PERMISSION });
  }
}

/**
 * Ensures that the directory exists synchronous. If the directory structure does not exist, it is created.
 * @param dirname 
 * @returns 
 */
export function ensureDirSync(dirname: fs.PathLike): void {
  if(!fs.existsSync(dirname)) return void fs.mkdirSync(dirname, { recursive: true, mode: FOLDER_PERMISSION });
    
  const stats = fs.statSync(dirname);
    
  if(!stats.isDirectory()) {
    fs.mkdirSync(dirname, { recursive: true, mode: FOLDER_PERMISSION });
  }
}


export async function writeBinary(
  filepath: fs.PathLike,
  data: Uint8Array,
  mask?: Uint8Array // eslint-disable-line comma-dangle
): Promise<void> {
  const d = (Buffer.isBuffer(data) ? data : Buffer.from(data));
  let out: Buffer;

  if(mask && (Buffer.isBuffer(mask) || mask instanceof Uint8Array)) {
    out = Buffer.alloc(d.length);
    maskBuffer(d, mask as Buffer, out, 0, d.length);
  } else {
    out = d;
  }

  await fs.promises.writeFile(filepath, Buffer.from(out.toString('binary')), { mode: FILE_PERMISSION });
}

export function writeBinarySync(
  filepath: fs.PathLike,
  data: Uint8Array,
  mask?: Uint8Array // eslint-disable-line comma-dangle
): void {
  const d = (Buffer.isBuffer(data) ? data : Buffer.from(data));

  let out: Buffer;
  if(mask && (Buffer.isBuffer(mask) || mask instanceof Uint8Array)) {
    out = Buffer.alloc(d.length);
    maskBuffer(d, mask as Buffer, out, 0, d.length);
  } else {
    out = d;
  }

  fs.writeFileSync(filepath, Buffer.from(out.toString('binary')), { mode: FILE_PERMISSION });
}

export async function readBinary(filepath: fs.PathLike, mask?: Uint8Array, length?: number, offset?: number): Promise<Buffer> {
  if(!fs.existsSync(filepath)) {
    throw new Exception(`File not found: ${filepath}`, 'ERR_FILE_NOT_FOUND');
  }

  const d = Buffer.from((await fs.promises.readFile(filepath)).toString(), 'binary');
  
  if(mask && (Buffer.isBuffer(mask) || mask instanceof Uint8Array)) {
    unmaskBuffer(d, mask as Buffer);
  }

  return d.subarray(offset, length ? length + (offset || 0) : undefined);
}


export function readBinarySync(filepath: fs.PathLike, mask?: Uint8Array, length?: number, offset?: number): Buffer {
  if(!fs.existsSync(filepath)) {
    throw new Exception(`File not found: ${filepath}`, 'ERR_FILE_NOT_FOUND');
  }

  const d = Buffer.from(fs.readFileSync(filepath).toString(), 'binary');

  if(mask && (Buffer.isBuffer(mask) || mask instanceof Uint8Array)) {
    unmaskBuffer(d, mask as Buffer);
  }

  return d.subarray(offset, length ? length + (offset || 0) : undefined);
}
