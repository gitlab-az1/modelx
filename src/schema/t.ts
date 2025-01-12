/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable no-inner-declarations */

import { MaybeArray } from 'src/types';
import { UUIDPattern } from '../@internals/id';
import { isBase64, isBase64Url, isDate, isEmail, isIPv4, isIPv6, isTimestamp, isURL } from '../util';


export namespace t {
  export type Infer<T> = T extends Schema<infer U> ? U : never;

  export type Rule = (
    | { kind: 'optional' }
    | { kind: 'nullable' }
    | { kind: 'default'; value: unknown }
    | { kind: 'min-length'; value: number }
    | { kind: 'max-length'; value: number }
    | { kind: 'length'; value: number }
    | { kind: 'n.min'; value: number }
    | { kind: 'n.max'; value: number }
    | { kind: 'n.integer' }
    | { kind: 'n.uint' }
    | { kind: 'n.decimal' }
    | { kind: 'str.starts-with'; value: string }
    | { kind: 'str.ends-with'; value: string }
    | { kind: 'str.includes'; value: string }
    | { kind: 'str.pattern'; value: RegExp }
    | { kind: 'enum'; members: readonly unknown[] }
    | { kind: 'arr.equals'; value: unknown[] }
    | { kind: 'arr.contains'; value: unknown }
    | { kind: 'str.cdt'; dt: 'email' | 'ip' | 'IPv4' | 'IPv6' | 'uuid' | 'base64' | 'base64url' | 'url' | 'date' | 'timestamp' | 'datetime' }
  ) & { customMessage?: string };

  export abstract class Schema<T, TO extends boolean = false> {
    protected _rules: Rule[] = [];
    protected _validationErrors: unknown[] = [];
    
    public constructor(protected _mainErrorMessage?: string) { }

    public get strictRequired(): TO extends true ? false : true {
      return (
        this._rules.filter(item => item.kind === 'optional' || item.kind === 'nullable').length === 0
      ) as any;
    }

    protected _invalidateRule(kind: Rule['kind']): void {
      this._rules = this._rules.filter(item => item.kind !== kind);
    }

    protected _hasRule(kind: Rule['kind']): boolean {
      return this._rules.findIndex(item => item.kind === kind) > -1;
    }

    public default(value: T, customMessage?: string): this {
      this._invalidateRule('default');
      this._rules.push({ kind: 'default', value, customMessage });

      return this;
    }

    public optional(): this {
      this._invalidateRule('optional');
      this._rules.push({ kind: 'optional' });

      return this;
    }

    public nullable(): this {
      this._invalidateRule('nullable');
      this._rules.push({ kind: 'nullable' });

      return this;
    }

    public transform<U>(transformer: (value: T) => U): Schema<U> {
      throw { loc: 'Schema#transform()', args: [transformer] };
      return this as unknown as Schema<U>;
    }

    public refine<U extends T>(predicate: (value: T) => value is U): Schema<U> {
      throw { loc: 'Schema#refine()', args: [predicate] };
      return this as unknown as Schema<U>;
    }

    public abstract parse(value?: unknown): T;
    // public abstract safeParse(value: unknown): { success: true; value: T } | { success: false; errors: unknown[] };
    
    public assert(value: unknown): asserts value is string {
      this.parse(value);
    }

    public validate(value: unknown): value is string {
      try {
        this.parse(value);
        return true;
      } catch {
        return false;
      }
    }
  }

  class AnyValueSchema extends Schema<any> {
    public parse(value: unknown): any {
      return value as unknown as any;
    }
  }

  class StringSchema extends Schema<string> {
    public minLength(value: number, customMessage?: string): this {
      this._invalidateRule('min-length');
      this._rules.push({ kind: 'min-length', value, customMessage });

      return this;
    }

    public maxLength(value: number, customMessage?: string): this {
      this._invalidateRule('max-length');
      this._rules.push({ kind: 'max-length', value, customMessage });

      return this;
    }

    public length(value: number, customMessage?: string): this {
      this._invalidateRule('length');
      this._rules.push({ kind: 'length', value, customMessage });

      return this;
    }

    public email(customMessage?: string): this {
      this._invalidateRule('str.cdt');
      this._rules.push({ kind: 'str.cdt', dt: 'email', customMessage });

      return this;
    }

    public ip(customMessage?: string): this {
      this._invalidateRule('str.cdt');
      this._rules.push({ kind: 'str.cdt', dt: 'ip', customMessage });

      return this;
    }

    public ipv4(customMessage?: string): this {
      this._invalidateRule('str.cdt');
      this._rules.push({ kind: 'str.cdt', dt: 'IPv4', customMessage });

      return this;
    }

    public ipv6(customMessage?: string): this {
      this._invalidateRule('str.cdt');
      this._rules.push({ kind: 'str.cdt', dt: 'IPv6', customMessage });

      return this;
    }

    public base64(customMessage?: string): this {
      this._invalidateRule('str.cdt');
      this._rules.push({ kind: 'str.cdt', dt: 'base64', customMessage });

      return this;
    }

    public base64url(customMessage?: string): this {
      this._invalidateRule('str.cdt');
      this._rules.push({ kind: 'str.cdt', dt: 'base64url', customMessage });

      return this;
    }

    public url(customMessage?: string): this {
      this._invalidateRule('str.cdt');
      this._rules.push({ kind: 'str.cdt', dt: 'url', customMessage });

      return this;
    }

    public date(customMessage?: string): this {
      this._invalidateRule('str.cdt');
      this._rules.push({ kind: 'str.cdt', dt: 'date', customMessage });

      return this;
    }

    public timestamp(customMessage?: string): this {
      this._invalidateRule('str.cdt');
      this._rules.push({ kind: 'str.cdt', dt: 'timestamp', customMessage });

      return this;
    }

    public datetime(customMessage?: string): this {
      this._invalidateRule('str.cdt');
      this._rules.push({ kind: 'str.cdt', dt: 'datetime', customMessage });

      return this;
    }

    public pattern(pattern: RegExp, customMessage?: string): this {
      this._invalidateRule('str.pattern');
      this._rules.push({ kind: 'str.pattern', value: pattern, customMessage });

      return this;
    }

    public startsWith(value: string, customMessage?: string): this {
      this._invalidateRule('str.starts-with');
      this._rules.push({ kind: 'str.starts-with', value, customMessage });

      return this;
    }

    public endsWith(value: string, customMessage?: string): this {
      this._invalidateRule('str.ends-with');
      this._rules.push({ kind: 'str.ends-with', value, customMessage });

      return this;
    }

    public includes(value: string, customMessage?: string): this {
      this._invalidateRule('str.includes');
      this._rules.push({ kind: 'str.includes', value, customMessage });

      return this;
    }

    public oneOf(members: readonly string[], customMessage?: string): this {
      this._invalidateRule('enum');
      this._rules.push({ kind: 'enum', members, customMessage });

      return this;
    }

    public parse(value?: unknown): string {
      this._validationErrors = [];
      
      if(typeof value === 'undefined' && (this._hasRule('optional') || this._hasRule('default')))
        return this._hasRule('optional') ? value as unknown as string : this._rules.find(item => item.kind === 'default')!.value as string;

      if(value === null && this._hasRule('nullable'))
        return value as unknown as string;

      if(typeof value !== 'string') {
        const err = new TypeError(this._mainErrorMessage || 'Expected value as \'typeof string\'');
        this._validationErrors.push(err);

        throw err;
      }

      for(let i = 0; i < this._rules.length; i++) {
        const rule = this._rules[i];
        
        switch(rule.kind) {
          case 'min-length': {
            if(value.length < rule.value) {
              this._validationErrors.push(
                new TypeError(rule.customMessage || `Expected a string with at least ${rule.value} characters`) // eslint-disable-line comma-dangle
              );
            }
          } break;
          case 'max-length': {
            if(value.length > rule.value) {
              this._validationErrors.push(
                new TypeError(rule.customMessage || `Expected a string with length less than or equals ${rule.value}`) // eslint-disable-line comma-dangle
              );
            }
          } break;
          case 'enum': {
            if(!rule.members.includes(value)) {
              this._validationErrors.push(
                new TypeError(rule.customMessage || `The value must be a member of enum [${rule.members.join(', ')}]`) // eslint-disable-line comma-dangle 
              );
            }
          } break;
          case 'length': {
            if(value.length !== rule.value) {
              this._validationErrors.push(
                new TypeError(rule.customMessage || `Expected a string with exactly ${rule.value} characters`) // eslint-disable-line comma-dangle
              );
            }
          } break;
          case 'str.ends-with': {
            if(!value.endsWith(rule.value)) {
              this._validationErrors.push(
                new TypeError(rule.customMessage || `Expected a string ending with \`${rule.value}\``) // eslint-disable-line comma-dangle
              );
            }
          } break;
          case 'str.starts-with': {
            if(!value.startsWith(rule.value)) {
              this._validationErrors.push(
                new TypeError(rule.customMessage || `Expected a string starting with \`${rule.value}\``) // eslint-disable-line comma-dangle
              );
            }
          } break;
          case 'str.includes': {
            if(!value.includes(rule.value)) {
              this._validationErrors.push(
                new TypeError(rule.customMessage || `The target string must includes \`${rule.value}\``) // eslint-disable-line comma-dangle
              );
            }
          } break;
          case 'str.pattern': {
            if(!rule.value.test(value)) {
              this._validationErrors.push(
                new TypeError(rule.customMessage || `Expected a string matching this pattern: ${rule.value}`) // eslint-disable-line comma-dangle
              );
            }
          } break;
          case 'str.cdt': {
            switch(rule.dt) {
              case 'uuid': {
                if(!UUIDPattern.test(value)) {
                  this._validationErrors.push(
                    new TypeError(rule.customMessage || 'Expected a string matching the UUID pattern') // eslint-disable-line comma-dangle
                  );
                }
              } break;
              case 'base64': {
                if(!isBase64(value)) {
                  this._validationErrors.push(
                    new TypeError(rule.customMessage || 'Expected a string matching the base64 pattern') // eslint-disable-line comma-dangle
                  );
                }
              } break;
              case 'base64url': {
                if(!isBase64Url(value)) {
                  this._validationErrors.push(
                    new TypeError(rule.customMessage || 'Expected a string matching the base64url pattern') // eslint-disable-line comma-dangle
                  );
                }
              } break;
              case 'IPv4': {
                if(!isIPv4(value)) {
                  this._validationErrors.push(
                    new TypeError(rule.customMessage || 'Expected a string matching the IPv4 pattern') // eslint-disable-line comma-dangle
                  );
                }
              } break;
              case 'IPv6': {
                if(!isIPv6(value)) {
                  this._validationErrors.push(
                    new TypeError(rule.customMessage || 'Expected a string matching the IPv6 pattern') // eslint-disable-line comma-dangle
                  );
                }
              } break;
              case 'ip': {
                if(!isIPv6(value) && !isIPv4(value)) {
                  this._validationErrors.push(
                    new TypeError(rule.customMessage || 'Expected a string matching the internet protocol pattern') // eslint-disable-line comma-dangle
                  );
                }
              } break;
              case 'date': {
                if(!isDate(value)) {
                  this._validationErrors.push(
                    new TypeError(rule.customMessage || 'Expected a string matching the date pattern') // eslint-disable-line comma-dangle
                  );
                }
              } break;
              case 'timestamp': {
                if(!isTimestamp(value)) {
                  this._validationErrors.push(
                    new TypeError(rule.customMessage || 'Expected a string matching the timestamp pattern') // eslint-disable-line comma-dangle
                  );
                }
              } break;
              case 'datetime': {
                if(!isTimestamp(value) && !isDate(value)) {
                  this._validationErrors.push(
                    new TypeError(rule.customMessage || 'Expected a string matching the datetime pattern') // eslint-disable-line comma-dangle
                  );
                }
              } break;
              case 'email': {
                if(!isEmail(value)) {
                  this._validationErrors.push(
                    new TypeError(rule.customMessage || 'Expected a string matching the email pattern') // eslint-disable-line comma-dangle
                  );
                }
              } break;
              case 'url': {
                if(!isURL(value)) {
                  this._validationErrors.push(
                    new TypeError(rule.customMessage || 'Expected a string matching the URL pattern') // eslint-disable-line comma-dangle
                  );
                }
              } break;
            }
          } break;
        }
      }

      if(this._validationErrors.length === 0) return value;

      if(this._validationErrors.length === 1) {
        throw this._validationErrors[0];
      }

      throw new AggregateError(this._validationErrors);
    }
  }

  class NumberSchema extends Schema<number> {
    public min(value: number, customMessage?: string): this {
      this._invalidateRule('n.min');
      this._rules.push({ kind: 'n.min', value, customMessage });

      return this;
    }

    public max(value: number, customMessage?: string): this {
      this._invalidateRule('n.max');
      this._rules.push({ kind: 'n.max', value, customMessage });

      return this;
    }

    public int(customMessage?: string): this {
      this._invalidateRule('n.integer');
      this._rules.push({ kind: 'n.integer', customMessage });

      return this;
    }

    public uint(customMessage?: string): this {
      this._invalidateRule('n.uint');
      this._rules.push({ kind: 'n.uint', customMessage });

      return this;
    }

    public decimal(customMessage?: string): this {
      this._invalidateRule('n.decimal');
      this._rules.push({ kind: 'n.decimal', customMessage });

      return this;
    }

    public oneOf(members: readonly number[], customMessage?: string): this {
      this._invalidateRule('enum');
      this._rules.push({ kind: 'enum', members, customMessage });

      return this;
    }

    public parse(value?: unknown): number {
      this._validationErrors = [];
      
      if(typeof value === 'undefined' && (this._hasRule('optional') || this._hasRule('default')))
        return this._hasRule('optional') ? value as unknown as number : this._rules.find(item => item.kind === 'default')!.value as number;

      if(value === null && this._hasRule('nullable'))
        return value as unknown as number;

      if(typeof value !== 'number') {
        const err = new TypeError(this._mainErrorMessage || 'Expected value as \'typeof number\'');
        this._validationErrors.push(err);

        throw err;
      }

      for(let i = 0; i < this._rules.length; i++) {
        const rule = this._rules[i];

        switch(rule.kind) {
          case 'n.min': {
            if(value < rule.value) {
              this._validationErrors.push(
                new TypeError(rule.customMessage || `Expected a value greater than or equals to ${rule.value}`) // eslint-disable-line comma-dangle
              );
            }
          } break;
          case 'n.max': {
            if(value > rule.value) {
              this._validationErrors.push(
                new TypeError(rule.customMessage || `Expected a value less than or equals to ${rule.value}`) // eslint-disable-line comma-dangle
              );
            }
          } break;
          case 'n.integer': {
            if(!Number.isInteger(value)) {
              this._validationErrors.push(
                new TypeError(rule.customMessage || 'Expected a integer number') // eslint-disable-line comma-dangle
              );
            }
          } break;
          case 'n.decimal': {
            if(Number.isInteger(value)) {
              this._validationErrors.push(
                new TypeError(rule.customMessage || 'Expected a decimal number') // eslint-disable-line comma-dangle
              );
            }
          } break;
          case 'n.uint': {
            if(!Number.isInteger(value) || value < 0) {
              this._validationErrors.push(
                new TypeError(rule.customMessage || 'Expected a unsigned integer number') // eslint-disable-line comma-dangle
              );
            }
          } break;
          case 'enum': {
            if(!rule.members.includes(value)) {
              this._validationErrors.push(
                new TypeError(rule.customMessage || `The value must be a member of enum [${rule.members.join(', ')}]`) // eslint-disable-line comma-dangle 
              );
            }
          } break;
        }
      }

      if(this._validationErrors.length === 0) return value;

      if(this._validationErrors.length === 1) {
        throw this._validationErrors[0];
      }

      throw new AggregateError(this._validationErrors);
    }
  }

  class ObjectSchema<T extends object> extends Schema<T> {
    public constructor(
      private readonly _shape: { [K in keyof T]: Schema<T[K]> },
      _message?: string // eslint-disable-line comma-dangle
    ) { super(_message); }

    public parse(value?: unknown): T {
      this._validationErrors = [];
      
      if(typeof value === 'undefined' && (this._hasRule('optional') || this._hasRule('default')))
        return this._hasRule('optional') ? value as unknown as T : this._rules.find(item => item.kind === 'default')!.value as T;

      if(value === null && this._hasRule('nullable'))
        return value as unknown as T;

      if(typeof value !== 'object' || Array.isArray(value)) {
        const err = new TypeError(this._mainErrorMessage || 'Expected value as \'typeof struct<template T>\'');
        this._validationErrors.push(err);

        throw err;
      }

      const result: Record<keyof T, T[keyof T]> = {} as unknown as any;

      for(const [key, schema] of Object.entries(this._shape)) {
        if(!(schema instanceof Schema)) {
          throw new Error(`Property '${key}' must store a 'typeof t.Schema<template T>'`);
        }

        try {
          const parsedValue = schema.parse((value as T)[key as keyof T]);
          result[key as keyof T] = parsedValue;
        } catch (err) {
          this._validationErrors.push(err);
        }
      }

      if(this._validationErrors.length === 0) return result as T;

      if(this._validationErrors.length === 1) {
        throw this._validationErrors[0];
      }

      throw new AggregateError(this._validationErrors);
    }
  }

  class ArraySchema<T extends unknown[]> extends Schema<T> {
    public constructor(
      private readonly _shape: MaybeArray<Schema<T[number]>>,
      _message?: string // eslint-disable-line comma-dangle
    ) { super(_message); }

    public minLength(value: number, customMessage?: string): this {
      this._invalidateRule('min-length');
      this._rules.push({ kind: 'min-length', value, customMessage });

      return this;
    }

    public maxLength(value: number, customMessage?: string): this {
      this._invalidateRule('max-length');
      this._rules.push({ kind: 'max-length', value, customMessage });

      return this;
    }

    public length(value: number, customMessage?: string): this {
      this._invalidateRule('length');
      this._rules.push({ kind: 'length', value, customMessage });

      return this;
    }

    public equals(value: T, customMessage?: string): this {
      this._invalidateRule('arr.equals');
      this._rules.push({ kind: 'arr.equals', value, customMessage });

      return this;
    }

    public contains(value: T[number], customMessage?: string): this {
      this._invalidateRule('arr.contains');
      this._rules.push({ kind: 'arr.contains', value, customMessage });

      return this;
    }

    public parse(value?: unknown): T {
      this._validationErrors = [];
      
      if(typeof value === 'undefined' && (this._hasRule('optional') || this._hasRule('default')))
        return this._hasRule('optional') ? value as unknown as T : this._rules.find(item => item.kind === 'default')!.value as T;

      if(value === null && this._hasRule('nullable'))
        return value as unknown as T;

      if(!Array.isArray(value)) {
        const err = new TypeError(this._mainErrorMessage || 'Expected value as \'typeof <template T>[]\'');
        this._validationErrors.push(err);

        throw err;
      }

      const result: T = [] as unknown as T;

      for(let i = 0; i < this._rules.length; i++) {
        const rule = this._rules[i];

        switch(rule.kind) {
          case 'arr.contains': {
            if(!value.includes(rule.value)) {
              this._validationErrors.push(
                new TypeError(rule.customMessage || `Expected 'typeof <template T>[]' to contains 'typeof ${typeof rule.value} ->> (${rule.value})'`) // eslint-disable-line comma-dangle
              );
            }
          } break;
          case 'min-length': {
            if(value.length < rule.value) {
              this._validationErrors.push(
                new TypeError(rule.customMessage || `Expected an array with at least ${rule.value} elements`) // eslint-disable-line comma-dangle
              );
            }
          } break;
          case 'max-length': {
            if(value.length > rule.value) {
              this._validationErrors.push(
                new TypeError(rule.customMessage || `Expected an array with length less than or equals ${rule.value}`) // eslint-disable-line comma-dangle
              );
            }
          } break;
          case 'length': {
            if(value.length !== rule.value) {
              this._validationErrors.push(
                new TypeError(rule.customMessage || `Expected an array with length exactly equals to ${rule.value}`) // eslint-disable-line comma-dangle
              );
            }
          } break;
          case 'arr.equals': {
            if(value.length !== rule.value.length) {
              this._validationErrors.push(
                new TypeError(rule.customMessage || 'The \'typeof <template T>[]\' must be equals the specified value') // eslint-disable-line comma-dangle
              );
            } else {
              for(let i = 0; i < value.length; i++) {
                if(value[i] !== rule.value[i]) {
                  this._validationErrors.push(
                    new TypeError(rule.customMessage || 'The \'typeof <template T>[]\' must be equals the specified value') // eslint-disable-line comma-dangle
                  );

                  break;
                }
              }
            }
          } break;
        }
      }

      if(!Array.isArray(this._shape)) {
        for(let i = 0; i < value.length; i++) {
          try {
            const parsedValue = this._shape.parse(value[i]);
            result.push(parsedValue);
          } catch (err) {
            this._validationErrors.push(err);
            break;
          }
        }
      } else {
        if(this._shape.length !== value.length) {
          this._validationErrors.push(
            new TypeError(this._mainErrorMessage || 'Expected value as \'typeof <template T>[]\': shape length missmatch') // eslint-disable-line comma-dangle
          );
        } else {
          for(let i = 0; i < this._shape.length; i++) {
            try {
              const parsedValue = this._shape[i].parse(value[i]);
              result.push(parsedValue);
            } catch (err) {
              this._validationErrors.push(err);
              break;
            }
          }
        }
      }

      if(this._validationErrors.length === 0) return result as T;

      if(this._validationErrors.length === 1) {
        throw this._validationErrors[0];
      }

      throw new AggregateError(this._validationErrors);
    }
  }


  export function any(): AnyValueSchema {
    return new AnyValueSchema();
  }

  export function string(message?: string): StringSchema {
    return new StringSchema(message);
  }

  export function number(message?: string): NumberSchema {
    return new NumberSchema(message);
  }

  export function object<T extends object>(shape: { [K in keyof T]: Schema<T[K]> }, message?: string): ObjectSchema<T> {
    return new ObjectSchema(shape, message);
  }

  export function array<T extends unknown[]>(shape: MaybeArray<Schema<T[number]>>, message?: string) {
    return new ArraySchema(shape, message);
  }

  export function custom<T>(schema: Schema<T>): Schema<T> {
    return schema;
  }
}

export default t;
