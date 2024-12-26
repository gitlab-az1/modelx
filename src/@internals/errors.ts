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
  ERR_TOKEN_CANCELLED = 1019,
  ERR_NO_CSPRNG = 1020,
  ERR_FILE_NOT_FOUND = 1021,
  ERR_INVALID_SIGNATURE = 1022,
  ERR_RESOURCE_LOCKED = 1023,
  ERR_UNWRAP_NONE = 1024,
  ERR_DATABASE_ERROR = 1025,
  ERR_MISSING_ENVIRONMENT_KEY = 1026,
  ERR_STREAM_PROCESSING_FAILURE = 1027,
  ERR_KERNEL_VAR_ALREADY_DECLARED = 1028,
  ERR_KERNEL_VAR_NOT_DECLARED = 1029,
  ERR_UNKNOWN_VAR_TYPE = 1030,
  ERR_ASSIGN_CONSTANT = 1031,
  ERR_MAX_LISTENERS_REACHED = 1032,
  ERR_RESOURCE_FORZEN = 1033,
  ERR_UNEXPECTED_TOKEN = 1034,
  ERR_CRYPTO_SHORT_KEY = 1035,
  ERR_MAGIC_NUMBER_MISSMATCH = 1036,
  ERR_INVALID_PROCESS_CMD = 1037,
  ERR_RESOURCE_ALREADY_INITIALIZED = 1038,
  ERR_AVOID_MODIFICATION = 1039,
  ERR_UNKNOWN_ERROR = 2001,
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
    case 'ERR_TOKEN_CANCELLED':
      return ERROR_CODE.ERR_TOKEN_CANCELLED;
    case 'ERR_NO_CSPRNG':
      return ERROR_CODE.ERR_NO_CSPRNG;
    case 'ERR_FILE_NOT_FOUND':
      return ERROR_CODE.ERR_FILE_NOT_FOUND;
    case 'ERR_INVALID_SIGNATURE':
      return ERROR_CODE.ERR_INVALID_SIGNATURE;
    case 'ERR_RESOURCE_LOCKED':
      return ERROR_CODE.ERR_RESOURCE_LOCKED;
    case 'ERR_UNWRAP_NONE':
      return ERROR_CODE.ERR_UNWRAP_NONE;
    case 'ERR_DATABASE_ERROR':
      return ERROR_CODE.ERR_DATABASE_ERROR;
    case 'ERR_MISSING_ENVIRONMENT_KEY':
      return ERROR_CODE.ERR_MISSING_ENVIRONMENT_KEY;
    case 'ERR_STREAM_PROCESSING_FAILURE':
      return ERROR_CODE.ERR_STREAM_PROCESSING_FAILURE;
    case 'ERR_KERNEL_VAR_ALREADY_DECLARED':
      return ERROR_CODE.ERR_KERNEL_VAR_ALREADY_DECLARED;
    case 'ERR_KERNEL_VAR_NOT_DECLARED':
      return ERROR_CODE.ERR_KERNEL_VAR_NOT_DECLARED;
    case 'ERR_UNKNOWN_VAR_TYPE':
      return ERROR_CODE.ERR_UNKNOWN_VAR_TYPE;
    case 'ERR_ASSIGN_CONSTANT':
      return ERROR_CODE.ERR_ASSIGN_CONSTANT;
    case 'ERR_MAX_LISTENERS_REACHED':
      return ERROR_CODE.ERR_MAX_LISTENERS_REACHED;
    case 'ERR_UNKNOWN_ERROR':
      return ERROR_CODE.ERR_UNKNOWN_ERROR;
    case 'ERR_RESOURCE_FORZEN':
      return ERROR_CODE.ERR_RESOURCE_FORZEN;
    case 'ERR_UNEXPECTED_TOKEN':
      return ERROR_CODE.ERR_UNEXPECTED_TOKEN;
    case 'ERR_CRYPTO_SHORT_KEY':
      return ERROR_CODE.ERR_CRYPTO_SHORT_KEY;
    case 'ERR_MAGIC_NUMBER_MISSMATCH':
      return ERROR_CODE.ERR_MAGIC_NUMBER_MISSMATCH;
    case 'ERR_INVALID_PROCESS_CMD':
      return ERROR_CODE.ERR_INVALID_PROCESS_CMD;
    case 'ERR_RESOURCE_ALREADY_INITIALIZED':
      return ERROR_CODE.ERR_RESOURCE_ALREADY_INITIALIZED;
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
    case ERROR_CODE.ERR_TOKEN_CANCELLED:
      return 'ERR_TOKEN_CANCELLED';
    case ERROR_CODE.ERR_NO_CSPRNG:
      return 'ERR_NO_CSPRNG';
    case ERROR_CODE.ERR_FILE_NOT_FOUND:
      return 'ERR_FILE_NOT_FOUND';
    case ERROR_CODE.ERR_INVALID_SIGNATURE:
      return 'ERR_INVALID_SIGNATURE';
    case ERROR_CODE.ERR_RESOURCE_LOCKED:
      return 'ERR_RESOURCE_LOCKED';
    case ERROR_CODE.ERR_UNWRAP_NONE:
      return 'ERR_UNWRAP_NONE';
    case ERROR_CODE.ERR_DATABASE_ERROR:
      return 'ERR_DATABASE_ERROR';
    case ERROR_CODE.ERR_MISSING_ENVIRONMENT_KEY:
      return 'ERR_MISSING_ENVIRONMENT_KEY';
    case ERROR_CODE.ERR_STREAM_PROCESSING_FAILURE:
      return 'ERR_STREAM_PROCESSING_FAILURE';
    case ERROR_CODE.ERR_KERNEL_VAR_ALREADY_DECLARED:
      return 'ERR_KERNEL_VAR_ALREADY_DECLARED';
    case ERROR_CODE.ERR_KERNEL_VAR_NOT_DECLARED:
      return 'ERR_KERNEL_VAR_NOT_DECLARED';
    case ERROR_CODE.ERR_UNKNOWN_VAR_TYPE:
      return 'ERR_UNKNOWN_VAR_TYPE';
    case ERROR_CODE.ERR_ASSIGN_CONSTANT:
      return 'ERR_ASSIGN_CONSTANT';
    case ERROR_CODE.ERR_MAX_LISTENERS_REACHED:
      return 'ERR_MAX_LISTENERS_REACHED';
    case ERROR_CODE.ERR_UNKNOWN_ERROR:
      return 'ERR_UNKNOWN_ERROR';
    case ERROR_CODE.ERR_RESOURCE_FORZEN:
      return 'ERR_RESOURCE_FORZEN';
    case ERROR_CODE.ERR_UNEXPECTED_TOKEN:
      return 'ERR_UNEXPECTED_TOKEN';
    case ERROR_CODE.ERR_CRYPTO_SHORT_KEY:
      return 'ERR_CRYPTO_SHORT_KEY';
    case ERROR_CODE.ERR_MAGIC_NUMBER_MISSMATCH:
      return 'ERR_MAGIC_NUMBER_MISSMATCH';
    case ERROR_CODE.ERR_INVALID_PROCESS_CMD:
      return 'ERR_INVALID_PROCESS_CMD';
    case ERROR_CODE.ERR_RESOURCE_ALREADY_INITIALIZED:
      return 'ERR_RESOURCE_ALREADY_INITIALIZED';
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
  public readonly description: string;

  public constructor(message: string, code: keyof typeof ERROR_CODE | number, contextObject?: Dict<unknown>) {
    super(message);

    Error.captureStackTrace(this);
    this.stackTrace = Stacktrace.create();

    this.context = contextObject;
    this.code = typeof code === 'number' ? code : stringToErrno(code);
    this.description = getErrorDescription(this.code);

    if(this.code > 0) {
      this.code = -this.code;
    }
  }
}


export function getErrorDescription(code: number): string {
  const errorDescriptions: { [key: number]: string | undefined } = {
    [ERROR_CODE.DONE]: 'Operation completed successfully.',
    [ERROR_CODE.ERR_STREAM_BUFFER_OVERFLOW]: 'Stream buffer overflow encountered.',
    [ERROR_CODE.ERR_END_OF_STREAM]: 'End of stream reached unexpectedly.',
    [ERROR_CODE.ERR_STREAM_BUFFER_UNDERFLOW]: 'Stream buffer underflow occurred.',
    [ERROR_CODE.ERR_STREAM_INVALID_CHUNK]: 'Invalid chunk detected in stream.',
    [ERROR_CODE.ERR_UNSUPPORTED_OPERATION]: 'The requested operation is not supported.',
    [ERROR_CODE.ERR_INVALID_ARGUMENT]: 'An invalid argument was provided.',
    [ERROR_CODE.ERR_INVALID_COMPRESSION_ALGORITHM]: 'Unsupported compression algorithm specified.',
    [ERROR_CODE.ERR_OUT_OF_RANGE]: 'Value is out of the acceptable range.',
    [ERROR_CODE.ERR_INVALID_TYPE]: 'Invalid data type encountered.',
    [ERROR_CODE.ERR_INVALID_ALGORITHM]: 'Invalid algorithm specified.',
    [ERROR_CODE.ERR_INVALID_AUTH_TAG]: 'Authentication tag is invalid.',
    [ERROR_CODE.ERR_OUT_OF_BOUNDS]: 'Index is out of bounds.',
    [ERROR_CODE.ERR_STREAM_DISPOSED]: 'Operation attempted on a disposed stream.',
    [ERROR_CODE.ERR_INVALID_IV_LENGTH]: 'The provided IV length is incorrect.',
    [ERROR_CODE.ERR_CRYPTO_INVALID_ALGORITHM]: 'Invalid cryptographic algorithm specified.',
    [ERROR_CODE.ERR_ENVIRONMENT_VARIABLE_REDECLARATION]: 'Attempted to redeclare an environment variable.',
    [ERROR_CODE.ERR_UNEXPECTED_PROMISE]: 'An unexpected promise was encountered.',
    [ERROR_CODE.ERR_RESOURCE_DISPOSED]: 'Resource has already been disposed.',
    [ERROR_CODE.ERR_ASSERTATION_FAILED]: 'An assertion failed.',
    [ERROR_CODE.ERR_TOKEN_CANCELLED]: 'Token operation was cancelled.',
    [ERROR_CODE.ERR_NO_CSPRNG]: 'No cryptographically secure random number generator available.',
    [ERROR_CODE.ERR_FILE_NOT_FOUND]: 'The specified file was not found.',
    [ERROR_CODE.ERR_INVALID_SIGNATURE]: 'Invalid digital signature detected.',
    [ERROR_CODE.ERR_RESOURCE_LOCKED]: 'Resource is currently locked.',
    [ERROR_CODE.ERR_UNWRAP_NONE]: 'Attempted to unwrap a non-existent value.',
    [ERROR_CODE.ERR_DATABASE_ERROR]: 'An error occurred in the database.',
    [ERROR_CODE.ERR_MISSING_ENVIRONMENT_KEY]: 'A required environment key is missing.',
    [ERROR_CODE.ERR_STREAM_PROCESSING_FAILURE]: 'An error occurred while processing the stream.',
    [ERROR_CODE.ERR_KERNEL_VAR_ALREADY_DECLARED]: 'Kernel variable has already been declared.',
    [ERROR_CODE.ERR_KERNEL_VAR_NOT_DECLARED]: 'Kernel variable is not declared.',
    [ERROR_CODE.ERR_UNKNOWN_VAR_TYPE]: 'The variable type is unknown.',
    [ERROR_CODE.ERR_ASSIGN_CONSTANT]: 'Cannot assign a value to a constant variable.',
    [ERROR_CODE.ERR_MAX_LISTENERS_REACHED]: 'The maximum number of event listeners has been reached.',
    [ERROR_CODE.ERR_RESOURCE_FORZEN]: 'The resource is frozen and cannot be modified.',
    [ERROR_CODE.ERR_UNEXPECTED_TOKEN]: 'An unexpected token was encountered in the input.',
    [ERROR_CODE.ERR_CRYPTO_SHORT_KEY]: 'The cryptographic key is too short.',
    [ERROR_CODE.ERR_MAGIC_NUMBER_MISSMATCH]: 'Magic number mismatch detected.',
    [ERROR_CODE.ERR_INVALID_PROCESS_CMD]: 'Invalid process command received.',
    [ERROR_CODE.ERR_UNKNOWN_ERROR]: 'An unknown error has occurred.',
  };

  return errorDescriptions[code] ?? 'unknown error';
}
