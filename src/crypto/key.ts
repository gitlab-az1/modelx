import { abs, round } from '../math/native';
import { setLastError } from '../environment';
import { generateRandomBytes } from './random';
import * as promises from '../@internals/async';
import { Exception } from '../@internals/errors';
import { type EntropyBufferRequest, EntropyDevice } from './entropy';
import { CancellationToken, ICancellationToken } from '../@internals/cancellation';


export type KeyGenOptions = {
  entropy?: EntropyDevice | EntropyBufferRequest;
  token?: ICancellationToken;
}

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
      const err = new Exception(`Asynchronous operation was cancelled by '${reason ? String(reason) : 'unknown reason'}'`, 'ERR_TOKEN_CANCELLED');

      setLastError(err);
      reject(err);
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

        if(t.isCancellationRequested) return (() => {
          const err = new Exception('Asynchronous operation was cancelled', 'ERR_TOKEN_CANCELLED');

          setLastError(err);
          reject(err);
        })();

        resolve(Object.freeze(result));
      } else {
        const result = await (options?.entropy ? generateRandomBytes(byteLength, options.entropy, t) : generateRandomBytes(byteLength, t));

        if(t.isCancellationRequested) return (() => {
          const err = new Exception('Asynchronous operation was cancelled', 'ERR_TOKEN_CANCELLED');

          setLastError(err);
          reject(err);
        })();

        resolve(result);
      }
    } catch (err: any) {
      setLastError(err);
      throw err;
    }
  });
}
