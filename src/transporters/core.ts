import type { Dict } from '../@internals/types';
import { decryptIncomingBuffer, encryptOutgoingBuffer } from './raw-buffer';
import { TransportableSignedToken, createTransportableToken, parseSignedToken } from './token';


export { decryptIncomingBuffer, encryptOutgoingBuffer, TransportableSignedToken, createTransportableToken, parseSignedToken };


export class Transporter {
  readonly #enc: Uint8Array | ArrayBuffer | SharedArrayBuffer;
  readonly #sign: Uint8Array | ArrayBuffer | SharedArrayBuffer;

  public constructor(
    _encryptionKey: Uint8Array | ArrayBuffer | SharedArrayBuffer,
    _signatureKey: Uint8Array | ArrayBuffer | SharedArrayBuffer // eslint-disable-line comma-dangle
  ) {
    this.#enc = _encryptionKey;
    this.#sign = _signatureKey;
  }

  public encryptBuffer<T>(payload: T): Promise<Buffer> {
    return encryptOutgoingBuffer(payload, this.#enc, this.#sign);
  }

  public decryptBuffer<T>(input: Uint8Array): Promise<T> {
    return decryptIncomingBuffer(input, this.#enc, this.#sign);
  }

  public createToken<T>(payload: T, headers?: Dict<string | number | boolean>): Promise<TransportableSignedToken> {
    return createTransportableToken(payload, this.#enc, this.#sign, headers);
  }

  public parseToken<T>(input: TransportableSignedToken): Promise<T> {
    return parseSignedToken(input, this.#enc, this.#sign);
  }
}

export default Transporter;
