import { assert } from '../@internals/util';
import { SymmetricCipher } from './ciphers';
import { buffer } from '../@internals/buffer';
import { setLastError } from '../environment';
import { generateRandomBytes } from './random';
import * as promises from '../@internals/async';
import { Exception } from '../@internals/errors';
import { abs, max, min, round } from '../math/native';
import { type EntropyBufferRequest, EntropyDevice } from './entropy';
import type { BinaryHolder, LooseAutocomplete } from '../@internals/types';
import { CancellationToken, ICancellationToken } from '../@internals/cancellation';


export const MAX_ITERATIONS = 0x7ffffffe;


export type KeyGenOptions = {
  entropy?: EntropyDevice | EntropyBufferRequest;
  token?: ICancellationToken;
};

export function generateKey(byteLength: number, authTag: true, options?: KeyGenOptions): Promise<readonly [Buffer, Buffer]>;
export function generateKey(byteLength: number, authTag?: false, options?: KeyGenOptions): Promise<Buffer>;
export function generateKey(
  byteLength: number,
  authTag?: boolean,
  options?: KeyGenOptions // eslint-disable-line comma-dangle
): Promise<Buffer | readonly [authTag: Buffer, key: Buffer]> {
  const t = options?.token || CancellationToken.None;
  
  return promises.withAsyncBody(async (resolve, reject) => {
    t.onCancellationRequested(reason => {
      reject(
        setLastError(
          new Exception(`Asynchronous operation was cancelled by '${reason ? String(reason) : 'unknown reason'}'`, 'ERR_TOKEN_CANCELLED') // eslint-disable-line comma-dangle
        ) // eslint-disable-line comma-dangle
      );
    });

    try {
      if(authTag === true) {
        const authLen = byteLength > 32 ?
          abs(round(byteLength / 8)) :
          byteLength >= 16 ? 8 : 4;
  
        const result = await Promise.all([
          (options?.entropy ? generateRandomBytes(authLen, options.entropy, t) : generateRandomBytes(authLen, t)),
          (options?.entropy ? generateRandomBytes(byteLength, options.entropy, t) : generateRandomBytes(byteLength, t)),
        ]);

        if(t.isCancellationRequested) return void reject(setLastError(new Exception('Asynchronous operation was cancelled', 'ERR_TOKEN_CANCELLED')));
        resolve(Object.freeze(result));
      } else {
        const result = await (options?.entropy ? generateRandomBytes(byteLength, options.entropy, t) : generateRandomBytes(byteLength, t));

        if(t.isCancellationRequested) return void reject(setLastError(new Exception('Asynchronous operation was cancelled', 'ERR_TOKEN_CANCELLED')));
        resolve(result);
      }
    } catch (err: any) {
      throw setLastError(err);
    }
  });
}


export type KeyDerivationOptions = {
  iterations?: number;
  memoryCost?: number;
  parallelism?: number;
};

export async function deriveKey(
  algorithm: 'pbkdf2' | 'argon2' | 'hmac-sha512',
  key: BinaryHolder,
  password: BinaryHolder | string,
  options?: KeyDerivationOptions // eslint-disable-line comma-dangle
): Promise<Buffer> {
  try {
    assert(typeof algorithm === 'string' && ['pbkdf2', 'argon2', 'hmac-sha512'].includes(algorithm));

    const k = buffer(key);
    key = null!;

    const pwd = typeof password === 'string' ? Buffer.from(password) : buffer(password);
    password = null!;

    let it = 10000;

    if(typeof options?.iterations === 'number') {
      assert(Number.isInteger(options.iterations) && Number.isFinite(options.iterations));
      it = min(max(options.iterations, 1), MAX_ITERATIONS);
    }

    return promises.withAsyncBody(async (resolve, reject) => {
      switch(algorithm) {
        case 'pbkdf2': {
          if(typeof window !== 'undefined' && !!window.crypto && !!window.crypto.subtle) {
            const params: Pbkdf2Params = {
              name: 'PBKDF2',
              salt: pwd,
              iterations: it,
              hash: { name: 'SHA-512' },
            };
        
            const key = await window.crypto.subtle.importKey(
              'raw',
              k,
              { name: 'PBKDF2' },
              false,
              ['deriveBits'] // eslint-disable-line comma-dangle
            );
        
            resolve(Buffer.from((await window.crypto.subtle.deriveBits(params, key, 512))));
          } else {
            const { pbkdf2 } = await import('crypto');

            pbkdf2(
              k,
              pwd,
              it,
              64,
              'sha512',
              (err, buffer) => {
                if(!err) return void resolve(buffer);
                reject(setLastError(err));
              },
            );
          }
        } break;
        case 'argon2': {
          reject(setLastError(new Exception('Key derivation with \'argon2\' is not supported yet.', 'ERR_UNSUPPORTED_OPERATION')));
        } break;
        case 'hmac-sha512': {
          if(typeof window !== 'undefined' && !!window.crypto && !!window.crypto.subtle) {
            const signingAlgorithm = {
              name: 'HMAC',
              hash: { name: 'SHA-512' },
            };

            const wrappedKey = await window.crypto.subtle.importKey('raw', pwd, signingAlgorithm, false, ['sign']);
            resolve(Buffer.from((await window.crypto.subtle.sign(signingAlgorithm, wrappedKey, k))));
          } else {
            const { createHmac } = await import('crypto');
            resolve(createHmac('sha512', pwd).update(k).digest());
          }
        }
      }
    });
  } catch (err: any) {
    throw setLastError(err);
  }
}



export type KeyOptions = {
  password?: BinaryHolder | string;
  algorithm: LooseAutocomplete<SymmetricCipher> | {
    name: LooseAutocomplete<SymmetricCipher>;
    length: number;
  };
  usages?: KeyUsage[];
  format?: KeyFormat | 'armored';
  ivLength?: number;
  authTagLength?: number;
  keyDerivation?: 'pbkdf2' | 'argon2' | 'hmac-sha512';
};

export class SymmetricKey {
  public static async new(rawKey: BinaryHolder | string, options: KeyOptions): Promise<SymmetricKey> {
    let len: number = typeof options.algorithm === 'object' ? options.algorithm.length : 0;
    let ivlen = options.ivLength || 0;
    let authLen = options.authTagLength || 0;

    const alg = ((typeof options.algorithm === 'object' ? (<any>options.algorithm).name : options.algorithm) as LooseAutocomplete<SymmetricCipher>).toLowerCase();

    if(alg.includes('aes')) {
      len = alg.includes('128') ? 16 : alg.includes('192') ? 24 : 32;
      
      if(ivlen === 0) {
        ivlen = 16;
      }

      if(authLen === 0) {
        authLen = 16;
      }
    } else if(alg.includes('camellia')) {
      len = alg.includes('128') ? 16 : alg.includes('192') ? 24 : 32;
      
      if(ivlen === 0) {
        ivlen = 16;
      }

      if(authLen === 0) {
        authLen = 16;
      }
    } else if(alg.includes('chacha20')) {
      if(len === 0) {
        len = 32;
      }

      if(ivlen === 0) {
        ivlen = 12;
      }

      if(authLen === 0) {
        authLen = 16;
      }
    }

    // eslint-disable-next-line no-extra-boolean-cast
    if(!!options.password) {
      rawKey = await deriveKey(
        options.keyDerivation || 'pbkdf2',
        typeof rawKey === 'string' ? Buffer.from(rawKey) : rawKey,
        options.password,
        { iterations: 50000, memoryCost: 4096 } // eslint-disable-line comma-dangle
      );
    }

    return new SymmetricKey(typeof rawKey === 'string' ? Buffer.from(rawKey) : buffer(rawKey),
      alg, len,
      ivlen, authLen,
      options.usages);
  }

  readonly #buffer: Buffer;
  readonly #algorithm: { name: string; length: number };
  readonly #tagLength: number;
  readonly #ivLength: number;
  readonly #usages: readonly KeyUsage[];

  private constructor(
    _buffer: Buffer,
    _algorithm: string,
    _keyLength: number,
    _ivLength?: number,
    _tagLength?: number,
    _usages?: KeyUsage[],
  ) {
    try {
      assert(Buffer.isBuffer(_buffer) && _keyLength >= 2 && typeof _keyLength === 'number' && Number.isInteger(_keyLength) && Number.isFinite(_keyLength) && _keyLength > 1);

      if(_buffer.byteLength < _keyLength) {
        throw new Exception(`Cannot create key for '${_algorithm}' with ${_keyLength * 8} bits because the key buffer have ${_buffer.byteLength * 8} bits`, 'ERR_INVALID_ARGUMENT');
      }
    } catch (err: any) {
      throw setLastError(err);
    }

    this.#buffer = _buffer;
    this.#ivLength = _ivLength || 0;
    this.#tagLength = _tagLength || 0;
    this.#usages = !!_usages && Array.isArray(_usages) ? _usages : ['decrypt', 'deriveBits', 'deriveKey', 'encrypt', 'sign', 'unwrapKey', 'verify', 'wrapKey'];
    this.#usages = Object.freeze(this.#usages);
    this.#algorithm = {
      name: _algorithm,
      length: _keyLength,
    };
  }

  public get byteLength(): number {
    return this.#algorithm.length;
  }

  public get ivLength(): number {
    return this.#ivLength;
  }

  public get authTagLength(): number {
    return this.#tagLength;
  }

  public get usages(): readonly KeyUsage[] {
    return this.#usages;
  }

  public valueOf(): Buffer {
    return this.#buffer.subarray(0, this.#algorithm.length);
  }

  public iv(): Buffer | null {
    if(this.#ivLength < 2) return null;
    if(this.#algorithm.length + this.#ivLength > this.#buffer.byteLength) return null;

    return this.#buffer.subarray(this.#algorithm.length, this.#algorithm.length + this.#ivLength);
  }

  public tag(): Buffer | null {
    if(this.#tagLength < 2) return null;
    let result: Buffer | null = null;

    if(this.#ivLength > 1) {
      if(this.#algorithm.length + this.#ivLength + this.#tagLength <= this.#buffer.byteLength) {
        result = this.#buffer.subarray(this.#algorithm.length + this.#ivLength, this.#algorithm.length + this.#ivLength + this.#tagLength);
      }
    } else {
      if(this.#algorithm.length + this.#tagLength <= this.#buffer.byteLength) {
        result = this.#buffer.subarray(this.#algorithm.length, this.#algorithm.length + this.#tagLength);
      }
    }

    return result;
  }
}
