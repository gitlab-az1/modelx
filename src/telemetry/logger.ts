import { delay } from '@ts-overflow/async/core';
import { EventLoop } from '@ts-overflow/async/event-loop';

import IOStream from '../io';
import { Span } from './metrics';
import type { Dict } from '../types';
import { ensureDirSync } from '../fs';
import { uuid } from '../@internals/id';
import { Exception } from '../@internals/errors';
import { IDisposable } from '../@internals/disposable';
import { jsonSafeStringify } from '../@internals/json';
import { AbstractLogger, formatStringTemplate, removeNonASCIICharacters } from '../logger/transporters';

import {
  ASCI_BLUE,
  ASCI_BRIGHT_YELLOW,
  ASCI_CYAN,
  ASCI_GREEN,
  ASCI_MAGENTA,
  ASCI_RED,
  ASCI_RESET,
  assert,
} from '../@internals/util';


export enum LOG_LEVEL {
  LOG = 0xA,
  DEBUG = 0x11,
  INFO = 0x12,
  WARNING = 0x13,
  ERROR = 0x14,
  TRACE = 0x98,
  VERBOSE = 0x99,
}


export interface LogEntry {
  message: string;
  args: any[];
  context?: Dict<any>;
  timestamp: number;
  level: LOG_LEVEL;
  service: string | null;
}


const flushModes = ['skip-to-parent', 'inherit-io', 'pick-current-only'] as const;

export type FlushMode = (typeof flushModes)[number];

export interface TelemetryInit {
  eol?: string;
  level?: LOG_LEVEL;
  serviceName?: string;
  parent?: AbstractLogger;
  flushMode?: FlushMode;
  omitTimestamp?: boolean;
  forceConsole?: boolean;
  onEntry?(entry: LogEntry): void;
  transporters?: readonly LoggerTransporter[];
}

type LoggerState = {
  eol: string;
  flushMode: FlushMode;
  disposed: boolean;
  level: LOG_LEVEL;
  omitTimestamp: boolean;
  forceConsole: boolean;
}


export class TelemetryLogger implements AbstractLogger, IDisposable {
  #serviceName: string;
  #parentLogger?: AbstractLogger;
  #transporters: Set<LoggerTransporter>;
  readonly #state: LoggerState;
  readonly #onEntryCallbacks: Set<(_entry: LogEntry & { plainTextMessage: string }) => void>;

  public constructor(init?: TelemetryInit);
  public constructor(serviceName?: string, options?: Omit<TelemetryInit, 'serviceName'>);
  public constructor(serviceNameOrInit?: string | TelemetryInit, options?: Omit<TelemetryInit, 'serviceName'>) {
    const o: TelemetryInit = {} as unknown as any;

    if(typeof serviceNameOrInit === 'string') {
      Object.assign(o, options, { serviceName: serviceNameOrInit });
    } else {
      Object.assign(o, serviceNameOrInit);
    }

    this.#state = {
      eol: o.eol || '\n',
      disposed: false,
      flushMode: o.flushMode || 'inherit-io',
      level: o.level || LOG_LEVEL.LOG,
      omitTimestamp: o.omitTimestamp || false,
      forceConsole: o.forceConsole || false,
    };

    this.#onEntryCallbacks = new Set();
    this.#transporters = new Set(o.transporters);
    this.#parentLogger = o.parent;
    this.#serviceName = o.serviceName || '';

    if(o.onEntry && typeof o.onEntry === 'function') {
      this.#onEntryCallbacks.add(o.onEntry);
    }
  }

  public get serviceName(): string {
    return this.#serviceName.slice(0);
  }

  public get level(): LOG_LEVEL {
    return this.#state.level;
  }

  public get transporters(): readonly LoggerTransporter[] {
    return Object.freeze([ ...this.#transporters.values() ]);
  }

  public onEntry(callback: (_entry: LogEntry & { plainTextMessage: string }) => void): void {
    if(this.#state.disposed) return;

    if(typeof callback !== 'function') {
      throw new Exception(`Cannot set 'typeof ${typeof callback}' as 'typeof function'`, 'ERR_INVALID_ARGUMENT');
    }

    this.#onEntryCallbacks.add(callback);
  }

  public offEntry(callback: (_entry: LogEntry & { plainTextMessage: string }) => void): void {
    if(this.#state.disposed) return;
    this.#onEntryCallbacks.delete(callback);
  }

  public pushTransporter(transporter: LoggerTransporter): boolean {
    if(this.#state.disposed) return false;

    this.#transporters.add(transporter);
    return true;
  }

  public removeTransporter(transporter: string | LoggerTransporter): void {
    if(this.#state.disposed) return;

    const id = typeof transporter === 'string' ? transporter : transporter.transporterId;

    const exists = Array.from(this.#transporters.values()).find(item => item.transporterId === id);
    if(!exists) return;

    this.#transporters = new Set(
      Array.from(this.#transporters.values()).filter(item => item.transporterId !== id) // eslint-disable-line comma-dangle
    );
  }

  public removeAllTransporters(dispose: boolean = false): void {
    if(dispose) {
      for(const transporter of this.#transporters.values()) {
        transporter.dispose?.();
      }
    }

    this.#transporters.clear();
  }

  public setParent(parentLogger: AbstractLogger): boolean {
    if(this.#state.disposed) return false;
    if(this.#parentLogger) return false;

    this.#parentLogger = parentLogger;
    return true;
  }

  public unlinkParent(): this {
    if(this.#state.disposed) return this;

    this.#parentLogger = void 0;
    return this;
  }

  public setMode(mode: FlushMode): boolean {
    if(this.#state.disposed) return false;
    if(!flushModes.includes(mode)) return false;

    this.#state.flushMode = mode;
    return true;
  }

  public setServiceName(value: string): boolean {
    if(this.#state.disposed) return false;
    if(typeof value !== 'string') return false;

    this.#serviceName = value;
    return true;
  }

  public info(message: string, context?: Dict<any> | null, ...args: any[]): void {
    if(this.#state.disposed) return;
    if(!this.#shouldLog(LOG_LEVEL.INFO)) return;

    const entry = this.#buildEntry(message, args, context, LOG_LEVEL.INFO);

    this.#dispatchMessage(entry);
    this.#callEntryListeners(entry);
  }

  public warn(message: string, context?: Dict<any> | null, ...args: any[]): void {
    if(this.#state.disposed) return;
    if(!this.#shouldLog(LOG_LEVEL.WARNING)) return;

    const entry = this.#buildEntry(message, args, context, LOG_LEVEL.WARNING);

    this.#dispatchMessage(entry);
    this.#callEntryListeners(entry);
  }

  public error(message: string, context?: Dict<any> | null, ...args: any[]): void {
    if(this.#state.disposed) return;
    if(!this.#shouldLog(LOG_LEVEL.ERROR)) return;

    const entry = this.#buildEntry(message, args, context, LOG_LEVEL.ERROR);

    this.#dispatchMessage(entry);
    this.#callEntryListeners(entry);
  }

  public trace(message: string, context?: Dict<any> | null, ...args: any[]): void {
    if(this.#state.disposed) return;
    if(!this.#shouldLog(LOG_LEVEL.TRACE)) return;

    const entry = this.#buildEntry(message, args, context, LOG_LEVEL.TRACE);

    this.#dispatchMessage(entry);
    this.#callEntryListeners(entry);
  }

  public verbose(message: string, context?: Dict<any> | null, ...args: any[]): void {
    if(this.#state.disposed) return;
    if(!this.#shouldLog(LOG_LEVEL.VERBOSE)) return;

    const entry = this.#buildEntry(message, args, context, LOG_LEVEL.VERBOSE);

    this.#dispatchMessage(entry);
    this.#callEntryListeners(entry);
  }

  public debug(message: string, context?: Dict<any>, ...args: any[]): void {
    if(this.#state.disposed) return;
    if(!this.#shouldLog(LOG_LEVEL.DEBUG)) return;

    const entry = this.#buildEntry(message, args, context, LOG_LEVEL.DEBUG);

    this.#dispatchMessage(entry);
    this.#callEntryListeners(entry);
  }

  public dispose(): void {
    if(this.#state.disposed) return;

    for(const transporter of this.#transporters.values()) {
      if(typeof transporter.dispose === 'function') {
        transporter.dispose();
      }
    }
    
    this.#onEntryCallbacks.clear();
    this.#transporters.clear();
    this.#parentLogger = undefined;
    this.#state.disposed = true;
  }

  #dispatchMessage(entry: LogEntry): void {
    if(this.#state.disposed) return;
    if(!this.#shouldLog(entry.level)) return;

    switch(this.#state.flushMode) {
      case 'skip-to-parent':
        this.#parentLogger?.[_levelToString(entry.level)](entry.message, ...entry.args);
        break;
      case 'inherit-io': {
        this.#parentLogger?.[_levelToString(entry.level)](entry.message, ...entry.args);

        const textMessage = this.#stringifyEntry(entry);
        
        if(typeof process !== 'undefined' && this.#state.forceConsole !== true) {
          process.stdout.write(textMessage);
        } else {
          console[_levelToString(entry.level)](textMessage.trim());
        }
      } break;
      case 'pick-current-only': {
        const textMessage = this.#stringifyEntry(entry);
        
        if(typeof process !== 'undefined' && this.#state.forceConsole !== true) {
          process.stdout.write(textMessage);
        } else {
          console[_levelToString(entry.level)](textMessage.trim());
        }
      } break;
    }
  }

  async #callEntryListeners(entry: LogEntry): Promise<void> {
    if(this.#state.disposed) return;

    for(const listener of this.#onEntryCallbacks.values()) {
      listener(Object.assign({}, entry, {
        plainTextMessage: removeNonASCIICharacters(this.#stringifyEntry(entry)),
      }));
    }

    for(const transporter of this.#transporters.values()) {
      if(!this.#shouldLog(transporter.level)) continue;

      try {
        await transporter.acceptEntry(Object.assign({}, entry, {
          plainTextMessage: removeNonASCIICharacters(this.#stringifyEntry(entry)),
        }));
      } catch { continue; }
    }
  }

  #buildEntry(message: string, args: any[], context?: Dict<any> | null, level?: LOG_LEVEL): LogEntry {
    return {
      message,
      args,
      context: context || undefined,
      timestamp: Date.now(),
      level: level || this.#state.level,
      service: this.#serviceName || null,
    };
  }

  #stringifyEntry(entry: LogEntry): string {
    let textMessage = '';

    if(!this.#state.omitTimestamp) {
      textMessage = `${ASCI_GREEN}${new Date().toISOString()}${ASCI_RESET} `;
    }

    textMessage += `${_colorizeLevel(entry.level)}[${_toNormalizedString(entry.level)}]${ASCI_RESET}`;

    if(this.#serviceName) {
      textMessage += ` ${ASCI_MAGENTA}(${this.#serviceName})${ASCI_RESET}`;
    }
    
    if(!!entry.args && Array.isArray(entry.args)) {
      for(let i = 0; i < entry.args.length; i++) {
        if(typeof (entry.args[i] as any).message === 'string') {
          const errCandidate = (entry.args[i] as unknown as Error);
          entry.args[i] = `|${errCandidate.name}| ${errCandidate.message} at ${errCandidate.stack || 'Unknown stack trace'}`;
        } else if(typeof entry.args[i] === 'object') {
          entry.args[i] = jsonSafeStringify(entry.args[i], null, 2) || '';
        }
      }
    }
    
    return `${textMessage.trim()} ${formatStringTemplate(entry.message, entry.args.concat([entry.context ? jsonSafeStringify({ context: entry.context }, null, 2) : null].filter(Boolean))).trim()}${this.#state.eol}`;
  }

  #shouldLog(level: LOG_LEVEL): boolean {
    return level >= this.#state.level;
  }
}


function _colorizeLevel(level: LOG_LEVEL): string {
  switch(level) {
    case LOG_LEVEL.ERROR:
      return ASCI_RED;
    case LOG_LEVEL.DEBUG:
      return ASCI_MAGENTA;
    case LOG_LEVEL.INFO:
    case LOG_LEVEL.VERBOSE:
      return ASCI_BLUE;
    case LOG_LEVEL.WARNING:
      return ASCI_BRIGHT_YELLOW;
    case LOG_LEVEL.TRACE:
      return ASCI_CYAN;
    default:
      return '';
  }
}

function _levelToString(level: LOG_LEVEL): 'info' | 'warn' | 'error' | 'trace' | 'debug' {
  const levelsMapping: Record<number, string> = {
    [LOG_LEVEL.INFO]: 'info',
    [LOG_LEVEL.WARNING]: 'warn',
    [LOG_LEVEL.ERROR]: 'error',
    [LOG_LEVEL.TRACE]: 'trace',
    [LOG_LEVEL.DEBUG]: 'debug',
  };

  return (levelsMapping[level] || 'debug') as any;
}

function _toNormalizedString(level: LOG_LEVEL): string {
  const normalized = LOG_LEVEL[level].toLowerCase().trim();

  if(normalized === 'warning') return 'warn';
  return normalized;
}


export abstract class LoggerTransporter {
  public readonly transporterId = uuid();
  public abstract readonly level: LOG_LEVEL;
  public abstract acceptEntry(entry: LogEntry & { plainTextMessage: string }): void | Promise<void>;
  public abstract dispose?(): void;
  public abstract whenIdle?(): Promise<void>;
}


// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace NodeJSLoggerEnvironment {
  /* eslint-disable no-inner-declarations */
  const environmentModules: {
    filesystem?: typeof import('fs');
    path?: typeof import('path');
  } = { };

  function _modules(): Required<typeof environmentModules> {
    if(!environmentModules.filesystem) {
      environmentModules.filesystem = require('fs');
    }

    if(!environmentModules.path) {
      environmentModules.path = require('path');
    }

    return environmentModules as Required<typeof environmentModules>;
  }

  type FileTransporterState = {
    disposed: boolean;
    level: LOG_LEVEL;
    fileLocation: IOStream.URI;
    maxFileSize?: number;
    byteLength: number;
    pendingBytes: number;
    eol: string;
    ioState: 'busy' | 'idle' | 'disposed' | 'error';
    silenceErrors: boolean;
  }

  export type FileTransporterOptions = {
    filepath: string | IOStream.URI;
    level?: LOG_LEVEL;
    maxFileSize?: number;
    eol?: string;
    silent?: boolean;
    onError?: (e: Exception) => void;
  }

  export class FileTransporter extends LoggerTransporter {
    readonly #state: FileTransporterState;
    #onError?: (e: Exception) => void;
    #onIdle?: Set<() => void>;
    readonly #pendingWriteEntries: (LogEntry & { plainTextMessage: string })[];

    public constructor(options: FileTransporterOptions) {
      super();
      const { path, filesystem } = _modules();

      if(!(options.filepath instanceof IOStream.URI)) {
        if(options.filepath.startsWith('../') || options.filepath.startsWith('./')) {
          options.filepath = path.resolve(options.filepath);
        }

        options.filepath = IOStream.URI.file(options.filepath);
      }

      ensureDirSync(path.dirname(options.filepath.toFileSystemPath()));

      const stat = filesystem.existsSync(options.filepath.toFileSystemPath()) ?
        filesystem.statSync(options.filepath.toFileSystemPath()) : null;

      if(options.maxFileSize) {
        assert(typeof options.maxFileSize === 'number' && Number.isInteger(options.maxFileSize) && options.maxFileSize > 0);
      }

      this.#state = {
        eol: options.eol || '\n',
        disposed: false,
        level: options.level || LOG_LEVEL.LOG,
        fileLocation: options.filepath,
        byteLength: stat?.size || 0,
        pendingBytes: 0,
        maxFileSize: options.maxFileSize,
        ioState: 'idle',
        silenceErrors: typeof options.silent === 'boolean' ? options.silent : true,
      };

      this.#onIdle = new Set();
      this.#pendingWriteEntries = [];
      this.#onError = options.onError;
    }

    public get file(): IOStream.URI {
      return this.#state.fileLocation;
    }

    public get filename(): string {
      return _modules().path.basename(this.#state.fileLocation.toFileSystemPath());
    }

    public get byteLength(): number {
      return this.#state.byteLength;
    }

    public get maxFileSize(): number | null {
      return this.#state.maxFileSize || null;
    }

    public get level(): LOG_LEVEL {
      return this.#state.level;
    }

    public get status(): FileTransporterState['ioState'] {
      return this.#state.ioState.slice(0) as any;
    }

    public whenIdle(): Promise<void> {
      if(this.#state.ioState === 'idle' && this.#pendingWriteEntries.length === 0) return Promise.resolve();

      return new Promise(resolve => {
        const fn = () => {
          if(this.#pendingWriteEntries.length > 0) return;
          resolve();
        };

        this.#onIdle?.add(fn);
      });
    }

    public acceptEntry(entry: LogEntry & { plainTextMessage: string; }): void {
      if(this.#state.disposed) {
        throw new Exception('FileTransporter is already disposed', 'ERR_RESOURCE_DISPOSED');
      }

      this.#pendingWriteEntries.push(entry);
      this.#state.pendingBytes += Buffer.byteLength(`${entry.plainTextMessage.trim()}${this.#state.eol}`);

      EventLoop.schedule(() => this.#process());
    }

    public dispose(): void {
      if(this.#state.disposed) return;

      this.#onIdle?.clear();
      this.#state.ioState = 'disposed';
      this.#pendingWriteEntries.length = 0;

      if(this.#state.pendingBytes > 0) {
        console.warn('[WARNING] [logger:FileTransporter] You\'re disposing the disk writer before write all changed rows');
      }

      this.#state.disposed = true;
    }

    async #process(): Promise<void> {
      if(this.#state.disposed) {
        throw new Exception('FileTransporter is already disposed', 'ERR_RESOURCE_DISPOSED');
      }

      if(this.#state.ioState !== 'idle' && this.#state.ioState !== 'busy') {
        throw new Exception(`Cannot write files with I/O '${this.#state.ioState}'`, 'ERR_UNSUPPORTED_OPERATION');
      }

      if(this.#state.ioState !== 'idle') return;

      for(const callback of this.#onIdle?.values() || []) {
        try {
          callback();
        } catch { continue; }
      }

      if(this.#pendingWriteEntries.length === 0) return;

      this.#state.ioState = 'busy';
      const entry = this.#pendingWriteEntries.shift();

      if(!entry) return void (this.#state.ioState = 'idle');

      const row = Buffer.from(`${entry.plainTextMessage.trim()}${this.#state.eol}`);
      const filePath = this.#state.fileLocation.toFileSystemPath();

      const { filesystem } = _modules();
    
      // Check if the file exceeds the maximum file size (if defined)
      if(this.#state.maxFileSize) {
        try {
          const stats = await filesystem.promises.stat(filePath);

          if(stats.size >= this.#state.maxFileSize) {
            const newPath = `${filePath}.${Date.now()}.log`;

            await filesystem.promises.rename(filePath, newPath); // Archive the current file
            await filesystem.promises.writeFile(filePath, '');

            this.#state.byteLength = 0;
          }
        } catch (error: any) {
          if(error.code !== 'ENOENT') { // Ignore if file doesn't exist
            const err = new Exception(`Error while checking file size: ${error.message}`, 'ERR_UNKNOWN_ERROR');

            this.#onError?.(err);
            this.#state.ioState = 'error';

            if(this.#state.silenceErrors === false) {
              throw err;
            }
          }
        }
      }

      if(this.#state.ioState === 'error') return;

      try {
        await filesystem.promises.appendFile(filePath, row);

        this.#state.pendingBytes -= row.byteLength;
        this.#state.byteLength += row.byteLength;

        this.#state.ioState = 'idle';

        await delay(500);
        EventLoop.schedule(() => this.#process());
      } catch (err: any) {
        let e = err;

        if(!(err instanceof Exception)) {
          e = new Exception(err?.message || String(err) || 'An unknown error was occured while writing log to the disk', 'ERR_UNKNOWN_ERROR');
        }

        this.#onError?.(e);
        this.#state.ioState = 'error';

        if(this.#state.silenceErrors === false) {
          throw e;
        }
      }
    }
  }

  export function ensureTransportersIdleBeforeExit(logger: TelemetryLogger): void {
    process.on('beforeExit', async () => {
      const transporters = logger.transporters;
      logger.removeAllTransporters();

      logger.trace('[NodeJS] process exit was called. Waiting to write pending logs...');

      const result = await Span.fromAsync(async () => {
        for(const transporter of transporters) {
          if(typeof transporter.whenIdle === 'function') {
            await transporter.whenIdle();
          }

          await delay(375);
        }
      }, 'logger_transporters.when_idle', {
        useHighResolutionClock: true,
        description: 'Measure the time waiting to all logger transporter to be into IDLE state',
      });

      logger.trace('[NodeJS] all log transporters closed in %d milliseconds', undefined, result.duration);
    });
  }

  /* eslint-enable no-inner-declarations */
}


export default TelemetryLogger;
