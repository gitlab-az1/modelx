import { hmac } from 'cryptx-sdk/hash';
import { deepCompare } from 'cryptx-sdk/core';

import { timestamp } from '../timer';
import type { Dict } from '../@internals/types';
import { Exception } from '../@internals/errors';
import { aesDecrypt, aesEncrypt } from '../crypto/weak-aes';
import { jsonSafeParser, jsonSafeStringify } from '../@internals/json';




/**
 * A transportable signed token is a package that contains an token and its signature
 * as well as the headers of the package and the signature of the package.
 * 
 * The headers are encoded as base64 and the signature is a string.
 */
export interface TransportableSignedToken {

  /**
   * The headers of the package encoded as base64
   */
  readonly headers: string;

  /**
   * The signature of the package
   */
  readonly signature: string;

  /**
   * The payload of the package including the token
   */
  readonly token: {
    
    /**
     * The target token transported by this package
     */
    readonly value: string;

    /**
     * The signature of the token transported by this package
     */
    readonly signature: string;
  };
}


export async function createTransportableToken<T>(payload: T,
  ckey: Uint8Array | ArrayBuffer | SharedArrayBuffer,
  skey: Uint8Array | ArrayBuffer | SharedArrayBuffer,
  headers?: Dict<string | number | boolean>): Promise<TransportableSignedToken> {
  const text = jsonSafeStringify(payload);

  if(!text) {
    throw new Exception('Failed to serialize payload.', 'ERR_UNSUPPORTED_OPERATION');
  }

  const signKey = Buffer.isBuffer(skey) ? skey : Buffer.from(skey);

  const u8Sign = await hmac(Buffer.from(text),
    signKey,
    'sha512', 'bytearray');

  const token = Object.freeze({
    signature: Buffer.from(u8Sign).toString('base64'),
    value: (await aesEncrypt(text, ckey, 'base64')),
  });

  const h = {
    ...headers,
    'x-algorithm': 'X.TRANSPORTABLE_DEFAULT.x64.HMAC-SHA512',
    'x-signature': token.signature,
    'x-package-description': 'TransportableSignedToken',
    'x-sign-timestamp': timestamp(),
  };

  const pkg = {
    token,
    headers: Buffer.from(jsonSafeStringify(h)!).toString('base64'),
  };

  const u8PkgSign = await hmac(Buffer.from(jsonSafeStringify(pkg)!),
    signKey,
    'sha512', 'bytearray');

  return Object.freeze({
    token,
    headers: pkg.headers,
    signature: Buffer.from(u8PkgSign).toString('base64'),
  });
}

export async function parseSignedToken<T>(input: TransportableSignedToken, ckey: Uint8Array | ArrayBuffer | SharedArrayBuffer, skey: Uint8Array | ArrayBuffer | SharedArrayBuffer): Promise<T> {
  const signKey = Buffer.isBuffer(skey) ? skey : Buffer.from(skey);

  const u8PkgSign = await hmac(Buffer.from(jsonSafeStringify({
    token: input.token,
    headers: input.headers,
  })!),
  signKey,
  'sha512', 'bytearray');

  const isPackageSignatureValid = await deepCompare(u8PkgSign, Buffer.from(input.signature, 'base64'));

  if(!isPackageSignatureValid) {
    throw new Exception('Cannot verify the integrity of the token package', 'ERR_INVALID_SIGNATURE');
  }

  const h = JSON.parse(Buffer.from(input.headers, 'base64').toString('utf-8'));

  if(h['x-algorithm'] !== 'X.TRANSPORTABLE_DEFAULT.x64.HMAC-SHA512') {
    throw new Exception('Unsupported algorithm', 'ERR_UNSUPPORTED_OPERATION');
  }

  const decrypted = await aesDecrypt<string>(Buffer.from(input.token.value, 'base64'), ckey);
  const payloadSign = await hmac(Buffer.from(decrypted.payload),
    signKey,
    'sha512', 'bytearray');

  const isPayloadSignatureValid = await deepCompare(Buffer.from(payloadSign), Buffer.from(input.token.signature, 'base64'));

  if(!isPayloadSignatureValid) {
    throw new Exception('Cannot verify the integrity of the token', 'ERR_INVALID_SIGNATURE');
  }

  const parsed = jsonSafeParser<T>(decrypted.payload);

  if(parsed.isLeft()) {
    throw new Exception('Failed to parse token payload', 'ERR_INVALID_ARGUMENT');
  }

  return parsed.value;
}


export default Object.freeze({
  createTransportableToken,
  parseSignedToken,
} as const);
