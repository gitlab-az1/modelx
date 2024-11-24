import type { Dict } from '../types';
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
  arguments: any[];
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

  public info(message: string, context?: Dict<any>, ...args: any[]): void {
    if(this.#state.disposed) return;
    if(!this.#shouldLog(LOG_LEVEL.INFO)) return;

    const entry = this.#buildEntry(message, args, context, LOG_LEVEL.INFO);

    this.#dispatchMessage(entry);
    this.#callEntryListeners(entry);
  }

  public warn(message: string, context?: Dict<any>, ...args: any[]): void {
    if(this.#state.disposed) return;
    if(!this.#shouldLog(LOG_LEVEL.WARNING)) return;

    const entry = this.#buildEntry(message, args, context, LOG_LEVEL.WARNING);

    this.#dispatchMessage(entry);
    this.#callEntryListeners(entry);
  }

  public error(message: string, context?: Dict<any>, ...args: any[]): void {
    if(this.#state.disposed) return;
    if(!this.#shouldLog(LOG_LEVEL.ERROR)) return;

    const entry = this.#buildEntry(message, args, context, LOG_LEVEL.ERROR);

    this.#dispatchMessage(entry);
    this.#callEntryListeners(entry);
  }

  public trace(message: string, context?: Dict<any>, ...args: any[]): void {
    if(this.#state.disposed) return;
    if(!this.#shouldLog(LOG_LEVEL.TRACE)) return;

    const entry = this.#buildEntry(message, args, context, LOG_LEVEL.TRACE);

    this.#dispatchMessage(entry);
    this.#callEntryListeners(entry);
  }

  public verbose(message: string, context?: Dict<any>, ...args: any[]): void {
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
        this.#parentLogger?.[_levelToString(entry.level)](entry.message, ...entry.arguments);
        break;
      case 'inherit-io': {
        this.#parentLogger?.[_levelToString(entry.level)](entry.message, ...entry.arguments);

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

  #buildEntry(message: string, args: any[], context?: Dict<any>, level?: LOG_LEVEL): LogEntry {
    return {
      message,
      arguments: args,
      context,
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

    if(!!entry.arguments && Array.isArray(entry.arguments)) {
      for(let i = 0; i < entry.arguments.length; i++) {
        if(typeof (entry.arguments[i] as any).message === 'string') {
          const errCandidate = (entry.arguments[i] as unknown as Error);
          entry.arguments[i] = `|${errCandidate.name}| ${errCandidate.message} at ${errCandidate.stack || 'Unknown stack trace'}`;
        } else if(typeof entry.arguments[i] === 'object') {
          entry.arguments[i] = jsonSafeStringify(entry.arguments[i], null, 2) || '';
        }
      }
    }

    return `${textMessage.trim()} ${formatStringTemplate(entry.message, entry.arguments)}${this.#state.eol}`;
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
}


export default TelemetryLogger;
