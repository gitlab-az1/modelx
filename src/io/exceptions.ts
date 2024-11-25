import type { Dict } from '../@internals/types';
import { optionalDefined, unwrap } from '../option';
import { jsonSafeStringify } from '../@internals/json';


export class StackTraceFrame {
  public readonly topLevel: boolean;

  public constructor(
    public readonly filename?: string,
    public readonly column?: number,
    public readonly line?: number,
    public readonly position?: number,
    public readonly source?: string,
    public readonly sourcePath?: string,
    public readonly origin?: string,
    public readonly isNative?: boolean,
    public readonly isConstructor?: boolean,
    _isTopLevel: boolean = false,
  ) { this.topLevel = _isTopLevel; }
}

export class StackTraceCollector {
  public static create(): StackTraceCollector {
    return new StackTraceCollector(new Error().stack || '');
  }

  public static parse(value: string): StackTraceCollector {
    return new StackTraceCollector(value);
  }

  public static parseFrames(stack: string | StackTraceCollector): readonly StackTraceFrame[] {
    if(stack instanceof StackTraceCollector) return Object.freeze( StackTraceCollector.#parseFrames(stack.toString(false)) );
    return Object.freeze( StackTraceCollector.#parseFrames(stack) );
  }

  public readonly frames: readonly StackTraceFrame[];

  private constructor(public readonly value: string) {
    this.frames = StackTraceCollector.#parseFrames(value);
  }

  public print(): void {
    console.log(this.value.split('\n').slice(2).join('\n'));
  }

  public files(): readonly string[] {
    return Object.freeze( this.frames.filter(item => !!item.filename).map(item => item.filename!) );
  }

  public lines(): readonly string[] {
    return Object.freeze( this.value.split('\n').slice(2) );
  }

  public toString(omitFirstLines: boolean = true): string {
    if(!omitFirstLines) return this.value.slice(0);
    return this.value.split('\n').slice(2).join('\n');
  }

  static #parseFrames(stack: string): StackTraceFrame[] {
    const lines = stack.split('\n').slice(2); // Skip the first two lines (Error + message)
    const frames: StackTraceFrame[] = [];

    for(let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^\s*at\s+(?:(.+?)\s+\()?(.+):(\d+):(\d+)\)?$/);

      if(match) {
        const [, origin, filename, lineNum, colNum] = match;

        frames.push( new StackTraceFrame(
          filename.trim(),
          parseInt(colNum, 10),
          parseInt(lineNum, 10),
          undefined,
          line.trim(),
          undefined,
          origin?.trim() || undefined,
          line.includes('[native code]'),
          origin?.includes('new ') || false,
          i === 0 // eslint-disable-line comma-dangle
        ) );
      }
    }

    return frames;
  }
}


export const enum ERROR_CODE {
  NO_ERROR = 0,
  ERR_UNKNOWN_ERROR = 1000,
  ERR_INVALID_ARGUMENT = 1001,
  ERR_NOT_IMPLEMENTED = 1002,
}


export function toErrorCode(key: keyof typeof ERROR_CODE): number {
  switch(key) {
    case 'NO_ERROR':
      return ERROR_CODE.NO_ERROR;
    case 'ERR_UNKNOWN_ERROR':
      return ERROR_CODE.ERR_UNKNOWN_ERROR;
    case 'ERR_INVALID_ARGUMENT':
      return ERROR_CODE.ERR_INVALID_ARGUMENT;
    case 'ERR_NOT_IMPLEMENTED':
      return ERROR_CODE.ERR_NOT_IMPLEMENTED;
    default:
      return -1;
  }
}

export function stringifyErrorCode(code: number): string {
  switch(code) {
    case ERROR_CODE.NO_ERROR:
      return 'NO_ERROR';
    case ERROR_CODE.ERR_INVALID_ARGUMENT:
        return 'ERR_INVALID_ARGUMENT';
    case ERROR_CODE.ERR_NOT_IMPLEMENTED:
      return 'ERR_NOT_IMPLEMENTED';
    case ERROR_CODE.ERR_UNKNOWN_ERROR:
    default:
      return 'ERR_UNKNOWN_ERROR';
  }
}

export function describeError(code: number | keyof typeof ERROR_CODE): string {
  switch(typeof code === 'number' ? code : toErrorCode(code)) {
    case ERROR_CODE.NO_ERROR:
      return 'The code was sucessful executed with no errors';
    case ERROR_CODE.ERR_INVALID_ARGUMENT:
      return 'An invalid argument was provided in somewhere of code';
    case ERROR_CODE.ERR_NOT_IMPLEMENTED:
      return 'An non-implemented method was called in somewhere of code';
    case ERROR_CODE.ERR_UNKNOWN_ERROR:
    default:
      return 'An unknown error occurred and the application did not handle it';
  }
}


export interface AbstractErrorObject {
  readonly name: string;
  readonly message: string;
  readonly code: ERROR_CODE;
  readonly description: string;
  readonly context?: Dict<any>;
  readonly stackTrace: {
    readonly value: string;
    readonly frames: readonly ({
      readonly filename?: string;
      readonly column?: number;
      readonly line?: number;
      readonly position?: number;
      readonly source?: string;
      readonly sourcePath?: string;
      readonly origin?: string;
      readonly isNative?: boolean;
      readonly isConstructor?: boolean;
      readonly isTopLevel: boolean;
    })[];
  };
}


export type ErrorOptions = {
  code?: ERROR_CODE | keyof typeof ERROR_CODE;
  context?: Dict<any>;
  stack?: string;
}

export class ThrowableException extends Error {
  public readonly name: string;
  public readonly message: string;
  public readonly code: number;
  public readonly description: string;
  public readonly context?: Dict<any>;
  public readonly stackTrace: StackTraceCollector;

  public constructor(message?: string, options?: ErrorOptions) {
    super(message);
    
    this.name = 'Throwable';
    this.message = message || 'Some unknown error has occurred';
    this.code = options?.code ? typeof options.code === 'number' ? options.code : toErrorCode(options.code) : ERROR_CODE.ERR_UNKNOWN_ERROR;
    this.description = describeError(this.code);
    this.stackTrace = options?.stack ? StackTraceCollector.parse(options.stack) : StackTraceCollector.create();
    this.context = options?.context;

    if(this.code > 0) {
      this.code = -this.code;
    }
  }

  public toErrorCode(): ERROR_CODE {
    return -this.code;
  }

  public toObject(): AbstractErrorObject {
    return Object.freeze<AbstractErrorObject>({
      code: this.code,
      description: this.description,
      message: this.message,
      name: this.name,
      context: this.context,
      stackTrace: {
        value: this.stackTrace.toString(false),
        frames: Object.freeze(
          this.stackTrace.frames.map(item => ({
            isTopLevel: item.topLevel,
            column: item.column,
            filename: item.filename,
            isConstructor: item.isConstructor,
            isNative: item.isNative,
            line: item.line,
            origin: item.origin,
            position: item.position,
            source: item.source,
            sourcePath: item.sourcePath,
          }) as AbstractErrorObject['stackTrace']['frames'][number]) // eslint-disable-line comma-dangle
        ),
      },
    });
  }

  public toJSON(): string {
    const str = jsonSafeStringify({
      code: this.code,
      description: this.description,
      message: this.message,
      name: this.name,
      context: this.context,
      stackTrace: {
        value: this.stackTrace.toString(false),
        frames: this.stackTrace.frames.map(item => ({
          isTopLevel: item.topLevel,
          column: item.column,
          filename: item.filename,
          isConstructor: item.isConstructor,
          isNative: item.isNative,
          line: item.line,
          origin: item.origin,
          position: item.position,
          source: item.source,
          sourcePath: item.sourcePath,
        }) // eslint-disable-line comma-dangle
        ),
      },
    });

    return unwrap( optionalDefined(str) );
  }
}

export class InvalidArgumentException extends ThrowableException {
  public override readonly name: string;

  public constructor(message?: string, options?: Omit<ErrorOptions, 'code'>) {
    super(message, Object.assign({}, options, { code: ERROR_CODE.ERR_INVALID_ARGUMENT }));
    this.name = 'InvalidArgumentException';
  }
}

export class NotImplementedException extends ThrowableException {
  public override readonly name: string;

  public constructor(location?: string, _paramsCollector?: any[], options?: Omit<ErrorOptions, 'code'>) {
    const message = `Missing implementation of ${location ? ('method ' + location) : 'unknown method'}`;

    super(message, Object.assign({}, options, { code: ERROR_CODE.ERR_NOT_IMPLEMENTED }));
    this.name = 'NotImplementedException';

    if(Array.isArray(_paramsCollector)) {
      _paramsCollector.length = 0;
    }
  }
}


export function isThrowableException(arg: unknown): arg is ThrowableException {
  return (
    arg instanceof InvalidArgumentException ||
    arg instanceof NotImplementedException ||
    arg instanceof ThrowableException
  );
}
