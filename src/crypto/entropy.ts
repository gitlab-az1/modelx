import { assert } from '../@internals/util';
import { setLastError } from '../environment';
import * as promises from '../@internals/async';
import { Exception } from '../@internals/errors';
import { CancellationToken, ICancellationToken } from '../@internals/cancellation';


export interface EntropyDevice {
  readonly brand: string;
  status(): Promise<EntropyDeviceStatus>;
  invoke(stopLength?: number, token?: ICancellationToken): Promise<Uint8Array>;
}

export const enum EntropyDeviceStatus {
  Offline = 0xF,
  Error = 0x10,
  Online = 0x11,
  Idle = 0x12,
  Busy = 0x13,
} 

export type EntropyBufferRequest = () => Promise<Uint8Array>;



export function isEntropyDevice(arg: unknown): arg is EntropyDevice {
  if(typeof arg !== 'object' || !arg || Array.isArray(arg)) return false;

  const candidate = (<EntropyDevice>arg);

  return typeof candidate.invoke === 'function' &&
    typeof candidate.status === 'function';
}


export const legacyDefaultEntropyDevice: EntropyDevice = Object.freeze<EntropyDevice>({
  brand: `com.${typeof process === 'undefined' ? (typeof window !== 'undefined' ? '__web__' : '__platform__') : '__node__'}.rand.dev`,

  invoke: Object.freeze(function(stopLength: number = 64, token: ICancellationToken = CancellationToken.None) {
    return promises.withAsyncBody<Uint8Array>(async (resolve, reject) => {
      try {
        assert(typeof stopLength === 'number' && stopLength > 2 && Number.isInteger(stopLength) && Number.isFinite(stopLength));
      } catch (err: any) {
        throw setLastError(err);
      }

      token.onCancellationRequested(reason => {
        const err = new Exception(`Asynchronous operation was cancelled by '${reason ? String(reason) : 'unknown reason'}'`, 'ERR_TOKEN_CANCELLED');
        reject(setLastError(err));
      });

      let buffer = new Uint8Array(stopLength);

      if(typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
        window.crypto.getRandomValues(buffer);
      } else if(typeof require !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { randomBytes } = require('crypto');
  
        buffer = null!;
        buffer = randomBytes(stopLength);
      } else return (() => {
        const err = new Exception('Secure random number generation is not available in this environment', 'ERR_NO_CSPRNG');

        setLastError(err);
        reject(err);
      })();

      if(token.isCancellationRequested) return (() => {
        const err = new Exception('Asynchronous operation was cancelled', 'ERR_TOKEN_CANCELLED');

        setLastError(err);
        reject(err);
      })();

      resolve(buffer);
    });
  }),

  status: Object.freeze(function() {
    return Promise.resolve(EntropyDeviceStatus.Idle);
  }),
});
