import { hmac } from 'cryptx-sdk/hash';
import { deepCompare } from 'cryptx-sdk/core';

import { Exception } from '../@internals/errors';
import { aesDecrypt, aesEncrypt } from '../crypto/weak-aes';
import { jsonSafeParser, jsonSafeStringify } from '../@internals/json';


export async function encryptOutgoingBuffer<T>(payload: T, ckey: Uint8Array | ArrayBuffer | SharedArrayBuffer, skey: Uint8Array | ArrayBuffer | SharedArrayBuffer): Promise<Buffer> {
  const text = jsonSafeStringify(payload);

  if(!text) {
    throw new Exception('Failed to serialize payload.', 'ERR_UNSUPPORTED_OPERATION');
  }

  const u8Sign = await hmac(Buffer.from(text),
    Buffer.isBuffer(skey) ? skey : Buffer.from(skey),
    'sha512', 'bytearray');

  let output = await aesEncrypt(text, ckey);
  const result = Buffer.alloc(output.byteLength + u8Sign.byteLength);

  for(let i = 0; i < u8Sign.byteLength; i++) {
    result[i] = u8Sign[i];
  }

  for(let i = 0; i < output.byteLength; i++) {
    result[i + u8Sign.byteLength] = output[i];
  }

  output = null!;
  return result;
}

export async function decryptIncomingBuffer<T>(input: Uint8Array, ckey: Uint8Array | ArrayBuffer | SharedArrayBuffer, skey: Uint8Array | ArrayBuffer | SharedArrayBuffer): Promise<T> {
  const HMAC_BYTE_LENGTH = 0x40;
  const u8Sign = input.slice(0, HMAC_BYTE_LENGTH);
  const output = input.slice(HMAC_BYTE_LENGTH);

  const decrypted = await aesDecrypt<string>(output, ckey);
  const payloadSign = await hmac(Buffer.from(decrypted.payload),
    Buffer.isBuffer(skey) ? skey : Buffer.from(skey),
    'sha512', 'bytearray');

  const isPayloadSignatureValid = await deepCompare(Buffer.from(payloadSign), u8Sign);

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
  encryptOutgoingBuffer,
  decryptIncomingBuffer,
});
