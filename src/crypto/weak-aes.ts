import { AES, SymmetricKey } from 'cryptx-sdk/symmetric';
import { type Decrypted } from 'cryptx-sdk/symmetric/core';


export function aesEncrypt(data: any, pass: Uint8Array | ArrayBuffer | SharedArrayBuffer): Promise<Uint8Array>;
export function aesEncrypt(data: any, pass: Uint8Array | ArrayBuffer | SharedArrayBuffer, encoding: BufferEncoding): Promise<string>;
export async function aesEncrypt(data: any, pass: Uint8Array | ArrayBuffer | SharedArrayBuffer, encoding?: BufferEncoding): Promise<string | Uint8Array> {
  const k = new SymmetricKey(Buffer.isBuffer(pass) ? pass : Buffer.from(pass), {
    algorithm: 'aes-256-cbc',
    usages: ['encrypt', 'decrypt', 'sign', 'verify'],
  });

  const aes = new AES(k, 'aes-256-cbc');
  const e = await aes.encrypt(data);

  if(!encoding) return e.buffer;
  return e.toString(encoding);
}

export async function aesDecrypt<T = any>(data: string | Uint8Array, pass: Uint8Array | ArrayBuffer | SharedArrayBuffer): Promise<Decrypted<T>> {
  const k = new SymmetricKey(Buffer.isBuffer(pass) ? pass : Buffer.from(pass), {
    algorithm: 'aes-256-cbc',
    usages: ['encrypt', 'decrypt', 'sign', 'verify'],
  });

  const aes = new AES(k, 'aes-256-cbc');
  return aes.decrypt(Buffer.isBuffer(data) ? data : Buffer.from(data));
}
