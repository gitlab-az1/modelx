import { floor } from '../math/native';
import { assert } from '../@internals/util';
import { setLastError } from '../environment';
import * as promises from '../@internals/async';
import { Exception } from '../@internals/errors';
import { type EntropyBufferRequest, EntropyDevice, EntropyDeviceStatus, isEntropyDevice } from './entropy';
import { CancellationToken, ICancellationToken, isCancellationToken } from '../@internals/cancellation';


export function generateRandomBytes(len: number, token?: ICancellationToken): Promise<Buffer>;
export function generateRandomBytes(len: number, entropy: EntropyDevice | EntropyBufferRequest, token?: ICancellationToken): Promise<Buffer>;
export function generateRandomBytes(
  len: number,
  entropy?: EntropyDevice | EntropyBufferRequest | ICancellationToken,
  token?: ICancellationToken // eslint-disable-line comma-dangle
): Promise<Buffer> {
  try {
    assert(typeof len === 'number' && len > 0 && Number.isInteger(len) && Number.isFinite(len));
  } catch (err: any) {
    setLastError(err);
    throw err;
  }

  const t = (isCancellationToken(entropy) ? entropy : token) || CancellationToken.None;

  return promises.withAsyncBody<Buffer>(async (resolve, reject) => {
    t.onCancellationRequested(reason => {
      const err = new Exception(`Asynchronous operation was cancelled by '${reason ? String(reason) : 'unknown reason'}'`, 'ERR_TOKEN_CANCELLED');

      setLastError(err);
      reject(err);
    });

    if(t.isCancellationRequested) return (() => {
      const err = new Exception('Asynchronous operation was cancelled', 'ERR_TOKEN_CANCELLED');

      setLastError(err);
      reject(err);
    })();

    try {
      let bucket = Buffer.alloc(len);
      const e = !isCancellationToken(entropy) ? (await getEntropy(entropy as EntropyBufferRequest | EntropyDevice, t)) : null;

      if(t.isCancellationRequested) return (() => {
        const err = new Exception('Asynchronous operation was cancelled', 'ERR_TOKEN_CANCELLED');

        setLastError(err);
        reject(err);
      })();

      if(typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
        window.crypto.getRandomValues(bucket);
      } else if(typeof require !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { randomBytes } = require('crypto');

        bucket = null!;
        bucket = randomBytes(len);
      } else return (() => {
        const err = new Exception('Secure random number generation is not available in this environment', 'ERR_NO_CSPRNG');

        setLastError(err);
        reject(err);
      })();

      if(t.isCancellationRequested) return (() => {
        const err = new Exception('Asynchronous operation was cancelled', 'ERR_TOKEN_CANCELLED');

        setLastError(err);
        reject(err);
      })();

      if(!e) return void resolve(bucket);

      for(let i = 0; i < bucket.length; i++) {
        bucket[i] ^= e[floor(i % e.length)];
      }

      if(t.isCancellationRequested) return (() => {
        const err = new Exception('Asynchronous operation was cancelled', 'ERR_TOKEN_CANCELLED');

        setLastError(err);
        reject(err);
      })();

      resolve(bucket);
    } catch (err: any) {
      setLastError(err);
      throw err;
    }
  });
}


function getEntropy(dev: EntropyDevice | EntropyBufferRequest, token: ICancellationToken = CancellationToken.None): Promise<Uint8Array | null> {
  if(!dev) return Promise.resolve(null);
  if(!isEntropyDevice(dev) && typeof dev !== 'function') return Promise.resolve(null);

  return promises.withAsyncBody(async (resolve, reject) => {
    token?.onCancellationRequested(reason => {
      reject(new Exception(`Asynchronous operation was cancelled by '${reason ? String(reason) : 'unknown reason'}'`, 'ERR_TOKEN_CANCELLED'));
    });

    try {
      if(isEntropyDevice(dev)) {
        const status = await dev.status();
        if(status !== EntropyDeviceStatus.Idle) return void reject(new Exception(`Cannot open '%.${dev.brand}'`, 'ERR_UNSUPPORTED_OPERATION'));
  
        const deviceBuffer = await dev.invoke(64, token);
    
        let u8 = new Uint8Array(deviceBuffer.byteLength);
        u8.set(deviceBuffer);
  
        if(token?.isCancellationRequested !== true) {
          resolve(u8);
          u8 = null!;
        } else {
          const err = new Exception('Asynchronous operation was cancelled', 'ERR_TOKEN_CANCELLED');

          setLastError(err);
          reject(err);
        }
      } else if(typeof dev === 'function') {
        const functionBuffer = await dev();
    
        let u8 = new Uint8Array(functionBuffer.byteLength);
        u8.set(functionBuffer);
  
        if(token?.isCancellationRequested !== true) {
          resolve(u8);
          u8 = null!;
        } else {
          const err = new Exception('Asynchronous operation was cancelled', 'ERR_TOKEN_CANCELLED');

          setLastError(err);
          reject(err);
        }
      }
    } catch (err: any) {
      setLastError(err);
      throw err;
    }
  });
}


export function generateRandomNumber(token?: ICancellationToken): Promise<number>;
export function generateRandomNumber(entropy: EntropyDevice | EntropyBufferRequest, token?: ICancellationToken): Promise<number>;
export async function generateRandomNumber(entropyOrToken?: ICancellationToken | EntropyBufferRequest | EntropyDevice, token?: ICancellationToken): Promise<number> {
  const buffer = await generateRandomBytes(1, entropyOrToken as any, token);
  return buffer[0] / 0xFF;
}
