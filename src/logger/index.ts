import { LogLevel, MessageStream } from './transporters';
import { stringifyLevel, toLevel } from './transporters/core';

export * from './transporters';
export * as transporters from './transporters';



export interface Logger {
  readonly level: number;
  readonly stringifiedLevel: string;

  log(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  fatal(message: string, ...args: any[]): void;
  trace(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
  verbose(message: string, ...args: any[]): void;
  report(message: string, ...args: any[]): void;
}


export type LoggerOptions = {
  namespace?: string;
  transporters?: readonly MessageStream[];
  level?: LogLevel | Lowercase<keyof typeof LogLevel>;
}

export function createLogger(options?: LoggerOptions): Logger {
  const t = [...(options?.transporters || [])];

  for(let i = 0; i < t.length; i++) {
    t[i].setNamespace(options?.namespace || null);
  }

  class l {
    public get level(): number {
      return toLevel(options?.level || LogLevel.Verbose);
    }

    public get stringifiedLevel(): string {
      return stringifyLevel(toLevel(options?.level || LogLevel.Verbose));
    }

    public log(message: string, ...args: any[]): void {
      for(let i = 0; i < t.length; i++) {
        t[i].log(message, ...args);
      }
    }

    public info(message: string, ...args: any[]): void {
      for(let i = 0; i < t.length; i++) {
        t[i].info(message, ...args);
      }
    }

    public warn(message: string, ...args: any[]): void {
      for(let i = 0; i < t.length; i++) {
        t[i].warn(message, ...args);
      }
    }

    public error(message: string, ...args: any[]): void {
      for(let i = 0; i < t.length; i++) {
        t[i].error(message, ...args);
      }
    }

    public fatal(message: string, ...args: any[]): void {
      for(let i = 0; i < t.length; i++) {
        t[i].fatal(message, ...args);
      }
    }

    public trace(message: string, ...args: any[]): void {
      for(let i = 0; i < t.length; i++) {
        t[i].trace(message, ...args);
      }
    }

    public debug(message: string, ...args: any[]): void {
      for(let i = 0; i < t.length; i++) {
        t[i].debug(message, ...args);
      }
    }

    public verbose(message: string, ...args: any[]): void {
      for(let i = 0; i < t.length; i++) {
        t[i].verbose(message, ...args);
      }
    }

    public report(message: string, ...args: any[]): void {
      for(let i = 0; i < t.length; i++) {
        t[i].report(message, ...args);
      }
    }
  }

  return new l();
}
