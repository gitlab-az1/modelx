import type { Dict } from './types';


export const enum ERROR_CODE {
  DONE = 0,
  ERR_STREAM_BUFFER_OVERFLOW = 1000,
  ERR_END_OF_STREAM = 1001,
  ERR_STREAM_BUFFER_UNDERFLOW = 1002,
  ERR_STREAM_INVALID_CHUNK = 1003,
  ERR_UNSUPPORTED_OPERATION = 1004,
  ERR_INVALID_ARGUMENT = 1005,
  ERR_INVALID_COMPRESSION_ALGORITHM = 1006,
  ERR_OUT_OF_RANGE = 1007,
  ERR_INVALID_TYPE = 1008,
  ERR_INVALID_ALGORITHM = 1009,
  ERR_INVALID_AUTH_TAG = 1010,
  ERR_OUT_OF_BOUNDS = 1011,
  ERR_STREAM_DISPOSED = 1012,
  ERR_INVALID_IV_LENGTH = 1013,
  ERR_CRYPTO_INVALID_ALGORITHM = 1014,
  ERR_ENVIRONMENT_VARIABLE_REDECLARATION = 1015,
  ERR_UNEXPECTED_PROMISE = 1016,
  ERR_RESOURCE_DISPOSED = 1017,
  ERR_ASSERTATION_FAILED = 1018,
}


export function stringToErrno(code: keyof typeof ERROR_CODE): number {
  switch(code) {
    case 'DONE':
      return ERROR_CODE.DONE;
    case 'ERR_END_OF_STREAM':
      return ERROR_CODE.ERR_END_OF_STREAM;
    case 'ERR_INVALID_ARGUMENT':
      return ERROR_CODE.ERR_INVALID_ARGUMENT;
    case 'ERR_STREAM_BUFFER_OVERFLOW':
      return ERROR_CODE.ERR_STREAM_BUFFER_OVERFLOW;
    case 'ERR_STREAM_BUFFER_UNDERFLOW':
      return ERROR_CODE.ERR_STREAM_BUFFER_UNDERFLOW;
    case 'ERR_STREAM_INVALID_CHUNK':
      return ERROR_CODE.ERR_STREAM_INVALID_CHUNK;
    case 'ERR_UNSUPPORTED_OPERATION':
      return ERROR_CODE.ERR_UNSUPPORTED_OPERATION;
    case 'ERR_INVALID_COMPRESSION_ALGORITHM':
      return ERROR_CODE.ERR_INVALID_COMPRESSION_ALGORITHM;
    case 'ERR_OUT_OF_RANGE':
      return ERROR_CODE.ERR_OUT_OF_RANGE;
    case 'ERR_INVALID_TYPE':
      return ERROR_CODE.ERR_INVALID_TYPE;
    case 'ERR_INVALID_ALGORITHM':
      return ERROR_CODE.ERR_INVALID_ALGORITHM;
    case 'ERR_INVALID_AUTH_TAG':
      return ERROR_CODE.ERR_INVALID_AUTH_TAG;
    case 'ERR_OUT_OF_BOUNDS':
      return ERROR_CODE.ERR_OUT_OF_BOUNDS;
    case 'ERR_INVALID_IV_LENGTH':
      return ERROR_CODE.ERR_INVALID_IV_LENGTH;
    case 'ERR_STREAM_DISPOSED':
      return ERROR_CODE.ERR_STREAM_DISPOSED;
    case 'ERR_CRYPTO_INVALID_ALGORITHM':
      return ERROR_CODE.ERR_CRYPTO_INVALID_ALGORITHM;
    case 'ERR_ENVIRONMENT_VARIABLE_REDECLARATION':
      return ERROR_CODE.ERR_ENVIRONMENT_VARIABLE_REDECLARATION;
    case 'ERR_UNEXPECTED_PROMISE':
      return ERROR_CODE.ERR_UNEXPECTED_PROMISE;
    case 'ERR_RESOURCE_DISPOSED':
      return ERROR_CODE.ERR_RESOURCE_DISPOSED;
    case 'ERR_ASSERTATION_FAILED':
      return ERROR_CODE.ERR_ASSERTATION_FAILED;
    default:
      return -1;
  }
}

export function errorCodeToString(code: number): string {
  switch(code) {
    case ERROR_CODE.DONE:
      return 'DONE';
    case ERROR_CODE.ERR_END_OF_STREAM:
      return 'ERR_END_OF_STREAM';
    case ERROR_CODE.ERR_INVALID_ARGUMENT:
      return 'ERR_INVALID_ARGUMENT';
    case ERROR_CODE.ERR_STREAM_BUFFER_OVERFLOW:
      return 'ERR_STREAM_BUFFER_OVERFLOW';
    case ERROR_CODE.ERR_STREAM_BUFFER_UNDERFLOW:
      return 'ERR_STREAM_BUFFER_UNDERFLOW';
    case ERROR_CODE.ERR_STREAM_INVALID_CHUNK:
      return 'ERR_STREAM_INVALID_CHUNK';
    case ERROR_CODE.ERR_UNSUPPORTED_OPERATION:
      return 'ERR_UNSUPPORTED_OPERATION';
    case ERROR_CODE.ERR_INVALID_COMPRESSION_ALGORITHM:
      return 'ERR_INVALID_COMPRESSION_ALGORITHM';
    case ERROR_CODE.ERR_OUT_OF_RANGE:
      return 'ERR_OUT_OF_RANGE';
    case ERROR_CODE.ERR_INVALID_TYPE:
      return 'ERR_INVALID_TYPE';
    case ERROR_CODE.ERR_INVALID_AUTH_TAG:
      return 'ERR_INVALID_AUTH_TAG';
    case ERROR_CODE.ERR_INVALID_ALGORITHM:
      return 'ERR_INVALID_ALGORITHM';
    case ERROR_CODE.ERR_OUT_OF_BOUNDS:
      return 'ERR_OUT_OF_BOUNDS';
    case ERROR_CODE.ERR_STREAM_DISPOSED:
      return 'ERR_STREAM_DISPOSED';
    case ERROR_CODE.ERR_INVALID_IV_LENGTH:
      return 'ERR_INVALID_IV_LENGTH';
    case ERROR_CODE.ERR_CRYPTO_INVALID_ALGORITHM:
      return 'ERR_CRYPTO_INVALID_ALGORITHM';
    case ERROR_CODE.ERR_ENVIRONMENT_VARIABLE_REDECLARATION:
      return 'ERR_ENVIRONMENT_VARIABLE_REDECLARATION';
    case ERROR_CODE.ERR_UNEXPECTED_PROMISE:
      return 'ERR_UNEXPECTED_PROMISE';
    case ERROR_CODE.ERR_RESOURCE_DISPOSED:
      return 'ERR_RESOURCE_DISPOSED';
    case ERROR_CODE.ERR_ASSERTATION_FAILED:
      return 'ERR_ASSERTATION_FAILED';
    default:
      return 'Unknown error';
  }
}

export class Stacktrace {
  public static create(): Stacktrace {
    return new Stacktrace(new Error().stack ?? '');
  }

  private constructor(readonly value: string) { }

  public print(): void {
    console.warn(this.value.split('\n').slice(2).join('\n'));
  }

  public toString(): string {
    return this.value;
  }
}


export class Exception extends Error {
  public override readonly name: string = 'Exception' as const;
  public readonly stackTrace: Stacktrace;
  public readonly code: number;
  public readonly context?: Dict<any>;

  public constructor(message: string, code: keyof typeof ERROR_CODE | number, contextObject?: Dict<unknown>) {
    super(message);

    Error.captureStackTrace(this);
    this.stackTrace = Stacktrace.create();

    this.context = contextObject;
    this.code = typeof code === 'number' ? -Math.abs(code) : -stringToErrno(code);

    if(Math.abs(this.code) === 0) {
      this.code = 0;
    }
  }
}
