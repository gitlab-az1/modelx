import { EventEmitter } from '@ts-overflow/async/events';

import {
  ASCI_BLUE,
  ASCI_BRIGHT_YELLOW,
  ASCI_CYAN,
  ASCI_MAGENTA,
  ASCI_RED,
} from '../../@internals/util';


export interface AbstractLogger {
  log?(message?: any, ...args: any[]): void;
  info(message?: any, ...args: any[]): void;
  warn(message?: any, ...args: any[]): void;
  error(message?: any, ...args: any[]): void;
  trace(message?: any, ...args: any[]): void;
  debug(message?: any, ...args: any[]): void;
}

export const enum LogLevel {
  Info = 0xF,
  Debug = 0x11,
  Warn = 0x12,
  Report = 0x13,
  Error = 0x14,
  Trace = 0x15,
  Fatal = 0x16,
  Verbose = 0x17,
}

export interface Message {
  text: string;
  level: LogLevel;
  arguments?: string[];
}


export type MessageStreamOptions = {
  eol?: string;
  level?: LogLevel;
  omitDate?: boolean;
  forceConsole?: boolean;
}

export abstract class MessageStream extends EventEmitter implements AbstractLogger {
  private _eol: string;
  private _ns: string | null;
  protected _omitDate: boolean;
  protected _forceConsole: boolean;
  protected readonly _level: LogLevel;

  public constructor(options?: MessageStreamOptions) {
    super({ onListenerError: console.error.bind(console) });

    let osModule: any;

    if(!(osModule = require('os'))) {
      this._eol = options?.eol || '\n';
    } else {
      this._eol = options?.eol || osModule.EOL;
    }

    this._eol ||= '\n';
    this._omitDate = options?.omitDate || false;
    this._level = options?.level || LogLevel.Verbose;
    this._forceConsole = options?.forceConsole || false;
  }

  public abstract transform(message: Message): string;
  public abstract _forward(message: Message): void;

  public get eol(): string {
    return this._eol;
  }

  public get level(): number {
    return this._level;
  }

  public get stringifiedLevel(): string {
    return stringifyLevel(this._level);
  }

  public setNamespace(namespace: string | null | undefined): void {
    this._ns = namespace || null;
  }

  public getNamespace(): string | null {
    return this._ns;
  }

  public on(event: 'message', listener: (__e: Message) => void): void;
  public on(event: 'message', listener: (event: Message) => void): void {
    this.subscribe(event, listener as () => void);
  }

  public off(event: 'message', listener: (__e: Message) => void): void;
  public off(event: 'message', listener: (event: Message) => void): void {
    this.removeListener(event, listener);
  }

  protected _accept(message: Message): void {
    this.emit('message', message);
    this._forward(message);
  }

  public log(text: string, ...args: any[]): void {
    this._accept({
      text,
      arguments: args,
      level: this._level,
    });
  }

  public info(text: string, ...args: any[]): void {
    this._accept({
      text,
      arguments: args,
      level: LogLevel.Info,
    });
  }

  public warn(text: string, ...args: any[]): void {
    this._accept({
      text,
      arguments: args,
      level: LogLevel.Warn,
    });
  }

  public error(text: string, ...args: any[]): void {
    this._accept({
      text,
      arguments: args,
      level: LogLevel.Error,
    });
  }

  public fatal(text: string, ...args: any[]): void {
    this._accept({
      text,
      arguments: args,
      level: LogLevel.Fatal,
    });
  }

  public trace(text: string, ...args: any[]): void {
    this._accept({
      text,
      arguments: args,
      level: LogLevel.Trace,
    });
  }

  public debug(text: string, ...args: any[]): void {
    this._accept({
      text,
      arguments: args,
      level: LogLevel.Debug,
    });
  }

  public verbose(text: string, ...args: any[]): void {
    this._accept({
      text,
      arguments: args,
      level: LogLevel.Verbose,
    });
  }

  public report(text: string, ...args: any[]): void {
    this._accept({
      text,
      arguments: args,
      level: LogLevel.Report,
    });
  }
}


export function stringifyLevel(level: LogLevel): string {
  switch(level) {
    case LogLevel.Error:
      return 'error';
    case LogLevel.Fatal:
      return 'fatal';
    case LogLevel.Info:
      return 'info';
    case LogLevel.Report:
      return 'report';
    case LogLevel.Trace:
      return 'trace';
    case LogLevel.Verbose:
      return 'verbose';
    case LogLevel.Warn:
      return 'warn';
    default:
      return 'unknown';
  }
}

export function toLevel(level: Lowercase<keyof typeof LogLevel> | number): LogLevel {
  if(typeof level === 'number') return level;
  
  switch(level) {
    case 'debug':
      return LogLevel.Debug;
    case 'error':
      return LogLevel.Error;
    case 'fatal':
      return LogLevel.Fatal;
    case 'info':
      return LogLevel.Info;
    case 'report':
      return LogLevel.Report;
    case 'trace':
      return LogLevel.Trace;
    case 'verbose':
      return LogLevel.Verbose;
    case 'warn':
      return LogLevel.Warn;
  }
}

export function colorizeLevel(level: LogLevel): string {
  switch(level) {
    case LogLevel.Error:
    case LogLevel.Fatal:
      return ASCI_RED;
    case LogLevel.Debug:
      return ASCI_MAGENTA;
    case LogLevel.Info:
    case LogLevel.Verbose:
      return ASCI_BLUE;
    case LogLevel.Warn:
      return ASCI_BRIGHT_YELLOW;
    case LogLevel.Report:
    case LogLevel.Trace:
      return ASCI_CYAN;
    default:
      return '';
  }
}

export function removeNonASCIICharacters(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/\u001b\[\d+m/g, '');
}


export function formatStringTemplate(template: string, args: any[] = []): string {
  let utilModule: any;

  // eslint-disable-next-line no-extra-boolean-cast
  if(!!(utilModule = require('util'))) return utilModule.format(template, ...args);

  let i = 0;

  return template.replace(/%[sdifoOj%]/g, (match) => {
    if(match === '%%') return '%';
    if(i >= args.length) return match;

    const arg = args[i++];

    switch (match) {
      case '%s': // String
        return String(arg);
      case '%d': // Number (integer or float)
      case '%f': // Float
        return Number(arg).toString();
      case '%i': // Integer
        return parseInt(arg, 10).toString();
      case '%j': // JSON
        try {
          return JSON.stringify(arg);
        } catch {
          return '[Circular]';
        }
      case '%o': // Object (basic object inspection)
        return inspect(arg, { showHidden: false });
      case '%O': // Object (detailed object inspection)
        return inspect(arg, { showHidden: true });
      default:
        return match;
    }
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function inspect(obj: any, _: { showHidden: boolean }): string {
  const cache = new Set();

  const replacer = (_: string, value: any) => {
    if(typeof value === 'object' && value !== null) {
      if(cache.has(value)) return '[Circular]';
      cache.add(value);
    }

    return value;
  };

  // If `showHidden` is true, include non-enumerable properties
  const serialized = JSON.stringify(obj, replacer, 2);

  cache.clear();
  return serialized;
}
