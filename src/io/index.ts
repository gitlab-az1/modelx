/* eslint-disable @typescript-eslint/no-namespace */

import math from 'next-math';

import type { PrimitiveDataType } from '../types';
import { IDisposable } from '../@internals/disposable';
import { isPlainObject, isThenable } from '../@internals/util';
import { Exception as PrimitiveException } from '../@internals/errors';

import {
  AbstractErrorObject as ExceptionObject,
  InvalidArgumentException,
  ThrowableException,
  describeError as getErrorDescription,
  isThrowableException,
  stringifyErrorCode as _stringifyErrorCode,
  toErrorCode as _toErrorCode,
  StackTraceFrame,
} from './exceptions';
import { createEnum } from 'src/object';


export namespace IOStream {
  export interface Readable<T extends NonNullable<unknown> = Uint8Array> {
    read(): T | null;
  }

  export interface StreamOptions {

    /**
     * The number of objects to buffer before WriteableStream#write()
     * signals back that the buffer is full. Can be used to reduce
     * the memory pressure when the stream is not flowing.
     */
    highWaterMark?: number;
  }

  export interface ReadableStreamInit extends StreamOptions {
    source?: Readable<Buffer> | NodeJS.ReadableStream;
  }

  export class ReadableStream implements StandardIOStream, Readable<Buffer> {
    readonly #init: ReadableStreamInit;
    readonly #buffer: Buffer[] = [];
    #byteLength: number = 0;

    readonly #state = {
      ended: false,
      disposed: false,
      paused: false,
    };

    public constructor(props?: ReadableStreamInit) {
      this.#init = props || {};
    }

    public get byteLength(): number {
      return this.#byteLength;
    }

    public read(): Buffer | null {
      if(this.#state.disposed || this.#state.ended) return null;

      if(this.#buffer.length > 0) {
        const chunk = this.#buffer.shift();

        if(chunk) {
          this.#byteLength -= chunk.byteLength;
          return chunk;
        }
      }

      if(this.#init.source && typeof this.#init.source.read === 'function') {
        const chunk = this.#init.source.read() as Buffer | null;

        if(chunk) {
          this.#byteLength += chunk.byteLength;
          return chunk;
        }
      }

      return null;
    }

    public end(): Buffer {
      if(this.#state.disposed) {
        throw new PrimitiveException('Cannot call \'end\' on a disposed stream', 'ERR_STREAM_DISPOSED');
      }

      this.#state.ended = true;
      return Buffer.concat(this.#buffer);
    }

    public return(): Buffer | null {
      if(!this.#state.ended || this.#state.disposed) return null;
      return Buffer.concat(this.#buffer);
    }

    public pause(): this {
      this.#state.paused = true;
      return this;
    }

    public resume(): this {
      this.#state.paused = false;
      return this;
    }

    public dispose(): void {
      if(this.#state.disposed) return;

      this.#byteLength = 0;
      this.#buffer.length = 0;
      this.#state.disposed = true;
    }
  }

  export class Char {
    public static get byteLength(): number {
      return 1;
    }

    public static get bitsLength(): number {
      return 8;
    }

    public static extractFromString(input: string): readonly Char[] {
      const characters = [] as Char[];

      for(let i = 0; i < input.length; i++) {
        characters.push(new Char(input.charCodeAt(i)));
      }

      return characters;
    }

    public static toString(characters: Char[]): string {
      if(!characters.every(x => x instanceof Char)) return '';
      return String.fromCharCode(...characters.map(item => item.#charCode));
    }

    #charCode: number;

    public constructor(value?: string | number) {
      if(!value) return;

      if(typeof value === 'string' && value.length >= 1) {
        this.#charCode = value.charCodeAt(0);
      } else if(typeof value === 'number' && value >= 0) {
        this.#charCode = value;
      }
    }

    public get byteLength(): number {
      return 1;
    }

    public get bitsLength(): number {
      return 8;
    }

    public get code(): number {
      return this.#charCode;
    }

    public toString(): string {
      return String.fromCharCode(this.#charCode);
    }
  }

  export interface StandardIOStream extends IDisposable {
    readonly byteLength: number;

    end(): Buffer;
    return(): Buffer | null;

    pause(): StandardIOStream;
    resume(): StandardIOStream;

    write?(payload: string | readonly Char[] | Uint8Array | Buffer): boolean;
    writeln?(payload: string | readonly Char[] | Uint8Array | Buffer): boolean;
  }

  export class Console implements StandardIOStream {
    public static build(props?: { forceConsole?: boolean }): Console {
      return new Console(props?.forceConsole);
    }

    readonly #chunks: Buffer[] = [];
    #byteLength: number = 0;

    #state = {
      ended: false,
      disposed: false,
      paused: false,
    };
    
    private constructor(
      private readonly _forceConsole: boolean = false // eslint-disable-line comma-dangle
    ) { }

    public get byteLength(): number {
      return this.#byteLength;
    }

    public write(payload: string | readonly Char[] | Buffer | Uint8Array): boolean {
      if(
        !Buffer.isBuffer(payload) &&
        !(payload instanceof Uint8Array) &&
        (!Array.isArray(payload) || !payload.every(char => char instanceof Char)) &&
        typeof payload !== 'string'
      ) return false;

      if(!Buffer.isBuffer(payload)) {
        payload = typeof payload === 'string' ?
          Buffer.from(payload, 'utf-8') :
          payload instanceof Uint8Array ?
            Buffer.from(payload) :
            Buffer.from(Char.toString(payload), 'utf-8');
      }

      return this.#flush(payload as Buffer); 
    }

    public writeln(payload?: string | readonly Char[] | Buffer | Uint8Array): boolean {
      if(!payload) {
        payload = '';
      }

      if(
        !Buffer.isBuffer(payload) &&
        !(payload instanceof Uint8Array) &&
        (!Array.isArray(payload) || !payload.every(char => char instanceof Char)) &&
        typeof payload !== 'string'
      ) return false;

      if(!Buffer.isBuffer(payload)) {
        payload = typeof payload === 'string' ?
          Buffer.from(payload, 'utf-8') :
          payload instanceof Uint8Array ?
            Buffer.from(payload) :
            Buffer.from(Char.toString(payload), 'utf-8');
      }

      return this.#flush(Buffer.concat([payload, Buffer.from('\n')])); 
    }

    public end(): Buffer {
      if(this.#state.disposed) {
        throw new PrimitiveException('Cannot call \'end\' of an disposed stream', 'ERR_STREAM_DISPOSED');
      }

      if(this.#state.ended) return Buffer.concat(this.#chunks);

      this.#state.ended = true;
      return Buffer.concat(this.#chunks);
    }

    public return(): Buffer | null {
      if(!this.#state.ended || this.#state.disposed) return null;
      return Buffer.concat(this.#chunks);
    }

    public pause(): this {
      if(this.#state.disposed) return this;
      
      if(!this.#state.paused) {
        this.#state.paused = true;
      }
      
      return this;
    }

    public resume(): this {
      if(this.#state.disposed) return this;
      
      if(this.#state.paused) {
        this.#state.paused = false;
      }

      return this;
    }

    public dispose(): void {
      if(this.#state.disposed) return;

      this.#byteLength = 0;
      this.#chunks.length = 0;

      this.#state.disposed = true;
    }

    #flush(payload: Buffer): boolean {
      if(this.#state.disposed || this.#state.ended || this.#state.paused) return false;

      try {
        let c = true;

        if(typeof process !== 'undefined' && !this._forceConsole) {
          c = process.stdout.write(payload.toString());
        } else {
          console.log(payload.toString());
        }

        if(!c) return false;

        this.#byteLength += payload.byteLength;
        this.#chunks.push(payload);

        return true;
      } catch (err: any) {
        console.error(err);
        return false;
      }
    }
  }

  export class Scanner {
    #buffer: string = '';
    #prefix: string = '';
    #suffix: string = '';

    #closed: boolean = false;
    #stream: Readable<Buffer | string>;
    readonly #delimiter: RegExp = /\s+/;

    public constructor(readable: Readable<Buffer | string>, delimiter?: RegExp) {
      this.#stream = readable;

      if(delimiter instanceof RegExp) {
        this.#delimiter = delimiter;
      }
    }

    public get prefix(): string | null {
      return this.#prefix && this.#prefix.length >= 1 ? this.#prefix.slice(0) : null;
    }

    public get suffix(): string | null {
      return this.#suffix && this.#suffix.length >= 1 ? this.#suffix.slice(0) : null;
    }

    #fillBuffer(): boolean {
      if(this.#closed) return false;
      let chunk: Buffer | string | null;
  
      while((chunk = this.#stream.read()) !== null) {
        if(!Buffer.isBuffer(chunk) && typeof chunk !== 'string') {
          throw new PrimitiveException(`Unexpected 'typeof ${typeof chunk}' token read in scanner`, 'ERR_INVALID_TYPE');
        }
  
        this.#buffer += chunk.toString();
        if(this.#buffer.match(this.#delimiter)) return true;
      }
  
      return this.#buffer.length > 0;
    }
  
    #nextToken(): string | null {
      while(!this.#buffer.match(this.#delimiter)) {
        if(!this.#fillBuffer()) return null;
      }
  
      const tokens = this.#buffer.split(this.#delimiter, 2);
      this.#buffer = tokens[1] || '';
  
      return tokens[0];
    }

    public nextInt(): number | null {
      if(this.#closed) return null;

      const token = this.#nextToken();
      if(token == null) return null;

      const result = parseInt(token, 10);

      if(isNaN(result)) throw new PrimitiveException(`Cannot parse '${token}' as a integer number`, 'ERR_INVALID_TYPE');
      return result;
    }

    public nextFloat(): number | null {
      if(this.#closed) return null;

      const token = this.#nextToken();
      if(token == null) return null;

      const result = parseFloat(token);

      if(isNaN(result)) throw new PrimitiveException(`Cannot parse '${token}' as a float point number`, 'ERR_INVALID_TYPE');
      return result;
    }
  
    public next(): string | null {
      if(this.#closed) return null;
  
      const token = this.#nextToken();
      return token ? this.#prefix + token + this.#suffix : null;
    }
  
    public nextBoolean(): boolean | null {
      const token = this.next();
      if(token === null) return null;
  
      if(token.toLowerCase() === 'true') return true;
      if(token.toLowerCase() === 'false') return false;
  
      throw new PrimitiveException(`Cannot parse '${token}' as a boolean`, 'ERR_INVALID_TYPE');
    }
  
    public findInLine(pattern: RegExp): string | null {
      const match = this.#buffer.match(pattern);

      if(match) {
        this.#buffer = this.#buffer.slice(match.index! + match[0].length);
        return match[0];
      }

      return null;
    }
  
    public nextChar(): Char | null {
      if(this.#closed) return null;
  
      while(this.#buffer.length === 0) {
        if(!this.#fillBuffer()) return null;
      }
  
      const charCode = this.#buffer.charCodeAt(0);
      this.#buffer = this.#buffer.slice(1);
  
      return new Char(charCode);
    }
  
    public skipPattern(pattern: RegExp): boolean {
      const match = this.#buffer.match(pattern);

      if(match && match.index === 0) {
        this.#buffer = this.#buffer.slice(match[0].length);
        return true;
      }

      return false;
    }
  
    public followPattern(pattern: RegExp): boolean {
      if(!this.#buffer.match(pattern)) {
        while(this.#fillBuffer()) {
          if(this.#buffer.match(pattern)) return true;
        }

        return false;
      }

      return true;
    }
  
    public setPrefix(prefix: string): void {
      this.#prefix = prefix;
    }

    public removePrefix(): void {
      this.#prefix = '';
    }
  
    public setSuffix(suffix: string): void {
      this.#suffix = suffix;
    }

    public removeSuffix(): void {
      this.#suffix = '';
    }
  
    public nextLine(): string | null {
      if(this.#closed) return null;
      let newlineIndex: number;
  
      while((newlineIndex = this.#buffer.indexOf('\n')) === -1) {
        if(!this.#fillBuffer()) break;
      }
  
      if(newlineIndex === -1) {
        if(this.#buffer.length === 0) return null;
  
        const line = this.#buffer;
        this.#buffer = '';
  
        return this.#prefix + line + this.#suffix;
      }
  
      const line = this.#buffer.slice(0, newlineIndex);
      this.#buffer = this.#buffer.slice(newlineIndex + 1);
  
      return this.#prefix + line + this.#suffix;
    }
  
    public hasNext(): boolean {
      if(this.#closed) return false;
      return this.#buffer.length > 0 || this.#fillBuffer();
    }
  
    public hasNextInt(): boolean {
      if(this.#closed) return false;
  
      const token = this.#peekNextToken();
      return token !== null && !isNaN(parseInt(token, 10));
    }
  
    public hasNextFloat(): boolean {
      if(this.#closed) return false;
  
      const token = this.#peekNextToken();
      return token !== null && !isNaN(parseFloat(token));
    }
  
    #peekNextToken(): string | null {
      const savedBuffer = this.#buffer;
      const token = this.#nextToken();
      this.#buffer = savedBuffer;
  
      return token;
    }
  
    public close(closeStream: boolean = false): void {
      if(this.#closed) return;
  
      if(closeStream) {
        if(typeof (this.#stream as any).end === 'function') {
          (this.#stream as any).end();
        }
  
        if(typeof (this.#stream as any).close === 'function') {
          (this.#stream as any).close();
        }
      }
  
      this.#buffer = '';
      this.#closed = true;
    }
  }

  export const stdout = Console.build();
  export const stdin = new (class extends ReadableStream {
    readonly #scanner: Scanner;

    public constructor() {
      super({
        source: typeof process !== 'undefined' ?
          process.stdin :
          { read() { return null; } },
      });

      this.#scanner = new Scanner(this);
    }

    public nextChar(): Char | null {
      return this.#scanner.nextChar();
    }

    public nextInt(): number | null {
      return this.#scanner.nextInt();
    }

    public nextFloat(): number | null {
      return this.#scanner.nextFloat();
    }

    public nextLine(): string | null {
      return this.#scanner.nextLine();
    }

    public nextBoolean(): boolean | null {
      return this.#scanner.nextBoolean();
    }

    public next(): string | null {
      return this.#scanner.next();
    }

    public hasNext(): boolean {
      return this.#scanner.hasNext();
    }

    public hasNextInt(): boolean {
      return this.#scanner.hasNextInt();
    }

    public hasNextFloat(): boolean {
      return this.#scanner.hasNextFloat();
    }

    public findInLine(pattern: RegExp): string | null {
      return this.#scanner.findInLine(pattern);
    }
    
    public followPattern(pattern: RegExp): boolean {
      return this.#scanner.followPattern(pattern);
    }

    public skipPattern(pattern: RegExp): boolean {
      return this.#scanner.skipPattern(pattern);
    }

    public getPrefix(): string | null {
      return this.#scanner.prefix;
    }

    public setPrefix(prefix: string): void {
      this.#scanner.setPrefix(prefix);
    }

    public removePrefix(): void {
      this.#scanner.removePrefix();
    }

    public getSuffix(): string | null {
      return this.#scanner.suffix;
    }

    public setSuffix(suffix: string): void {
      this.#scanner.setSuffix(suffix);
    }

    public removeSuffix(): void {
      this.#scanner.removeSuffix();
    }

    public override dispose(): void {
      this.#scanner.close();
      super.dispose();
    }
  })();


  export interface IteratorResult<T> {
    done: boolean;
    value?: T;
    position?: number;
  }
  
  export class Iterator<T> {
    readonly #buffer: T[];
    #cursor: number;
  
    public constructor(collection: Iterable<T>) {
      this.#buffer = [...collection];
      this.#cursor = 0;
    }
  
    public next(): IteratorResult<T> | null {
      if(this.#cursor >= this.#buffer.length) return null;
      const index = this.#cursor++;
  
      return {
        done: this.#cursor >= this.#buffer.length,
        position: index,
        value: this.#buffer[index],
      };
    }
  
    public prev(): IteratorResult<T> | null {
      if(this.#cursor <= 0) return null;
      const index = --this.#cursor;
  
      return {
        done: this.#cursor === this.#buffer.length,
        position: index,
        value: this.#buffer[index],
      };
    }
  
    public seek(pos: number): boolean {
      if(pos < 0 || pos >= this.#buffer.length) return false;
  
      this.#cursor = pos;
      return true;
    }
  
    public seekToFirst(): this {
      this.#cursor = 0;
      return this;
    }
  
    public seekToLast(): this {
      this.#cursor = this.#buffer.length - 1;
      return this;
    }
  
    public isEmpty(): boolean {
      return this.#buffer.length === 0;
    }

    public toArray(): T[] {
      return [ ...this.#buffer ];
    }
  
    public *[Symbol.iterator](): IterableIterator<T> {
      yield* this.#buffer;
    }
  }

  export type Predicate<T, S extends T> = (value: T) => value is S;

  type VecPredicate<T, S extends T> = (value: T, index: number, vec: Vec<T>) => value is S;
  type WeakVecPredicate<T> = (value: T, index: number, vec: Vec<T>) => unknown;

  type VecInit = {
    strictDataType?: PrimitiveDataType | 'struct' | 'array' | 'integer' | 'decimal' | ((value: unknown) => boolean);
    defaultLocked?: boolean;
    readonly?: boolean;
  }

  export class Vec<T> {
    #buffer: T[];
    #locked: boolean = false;
    #frozen: boolean = false;
    #itemsTrack: number = 0;
    readonly #maxLength: number;
    readonly #strictDataType?: PrimitiveDataType | 'struct' | 'array' | 'integer' | 'decimal' | ((value: unknown) => boolean);

    public constructor(size: number, options?: VecInit);
    public constructor(collection: T[], options?: VecInit);
    public constructor(sizeOrCollection: number | T[], options?: VecInit) {
      const len = typeof sizeOrCollection === 'number' ? sizeOrCollection : sizeOrCollection.length;

      this.#maxLength = len;
      this.#buffer = new Array(len);
      this.#strictDataType = options?.strictDataType;

      if(Array.isArray(sizeOrCollection)) {
        for(let i = 0; i < len; i++) {
          this.#assertDataType(sizeOrCollection[i]);
          this.#buffer[i] = sizeOrCollection[i];
          this.#itemsTrack++;
        }
      }
      
      if(options?.defaultLocked) {
        this.#locked = true;
      }

      if(options?.readonly) {
        this.#frozen = true;
      }
    }

    public get length(): number {
      return this.#itemsTrack;
    }
  
    public get isLocked(): boolean {
      return this.#locked;
    }
  
    public get isFrozen(): boolean {
      return this.#frozen;
    }
  
    public push(...items: T[]): boolean {
      if(this.#locked || this.#frozen) return false;
      if(this.#itemsTrack === this.#maxLength) return false;
  
      if(items.length + this.#itemsTrack > this.#maxLength) {
        items = items.slice(0, this.#maxLength - this.#itemsTrack);
      }
  
      for(let i = 0; i < items.length; i++) {
        this.#assertDataType(items[i]);
        this.#buffer[this.#itemsTrack + i] = items[i];
      }

      this.#itemsTrack += items.length;
      return true;
    }

    public unshift(...items: T[]): boolean {
      if(this.#locked || this.#frozen) return false;
      if(this.#itemsTrack === this.#maxLength) return false;
    
      if(items.length + this.#itemsTrack > this.#maxLength) {
        items = items.slice(0, this.#maxLength - this.#itemsTrack);
      }
    
      for(let i = this.#itemsTrack - 1; i >= 0; i--) {
        this.#buffer[i + items.length] = this.#buffer[i];
      }
    
      for(let i = 0; i < items.length; i++) {
        this.#assertDataType(items[i]);
        this.#buffer[i] = items[i];
      }
    
      this.#itemsTrack += items.length;
      return true;
    }

    public forEach(callbackfn: (value: T, index: number, vec: Vec<T>) => boolean, thisArg?: any): void {
      for(let i = 0; i < this.#itemsTrack; i++) {
        if(callbackfn.call(thisArg, this.#buffer[i], i, this) === false) break;
      }
    }
  
    public map<U>(callbackfn: (value: T, index: number, vec: Vec<T>) => U, thisArg?: any): Vec<U> {
      if(this.#locked || this.#frozen) {
        throw new PrimitiveException('Cannot map an frozen `Vec`', 'ERR_RESOURCE_FORZEN');
      }

      const output = [] as U[];

      for(let i = 0; i < this.#itemsTrack; i++) {
        console.log({i},this.#buffer[i]);
        output.push(callbackfn.call(thisArg, this.#buffer[i], i, this));
      }

      return new Vec(output);
    }

    public join(separator?: string): string {
      return this.#buffer.slice(0, this.#itemsTrack).join(separator);
    }

    public at(index: number): T | undefined {
      if(index > this.#itemsTrack) return undefined;

      if(index < 0) return this.#buffer[this.#buffer.length - (-index)];
      return this.#buffer[index];
    }

    public get(index: number) {
      return this.#buffer[index];
    }

    public set(index: number, value: T): boolean {
      try {
        this.#buffer[index] = value;
        return true;
      } catch {
        return false;
      }
    }

    public concat(...items: (T | ConcatArray<T> | Vec<T>)[]): Vec<T> {
      for(let i = 0; i < items.length; i++) {
        if(items[i] instanceof Vec) {
          items[i] = (<Vec<T>>items[i]).toArray();
        }
      }

      return new Vec(this.#buffer.concat(...items as (T | ConcatArray<T>)[]));
    }

    public copyWithin(target: number, start: number, end?: number): Vec<T> {
      return new Vec(this.#buffer.copyWithin(target, start, end));
    }

    public entries(): Iterator<[number, T]> {
      return new Iterator(this.#buffer.slice(0, this.#itemsTrack).entries());
    }

    public every<S extends T>(predicate: VecPredicate<T, S>, thisArg?: any): this is Vec<S> {
      for(let i = 0; i < this.#itemsTrack; i++) {
        if(!predicate.call(thisArg, this.#buffer[i], i, this)) return false;
      }

      return true;
    }

    public some<S extends T>(predicate: VecPredicate<T, S>, thisArg?: any): boolean {
      for(let i = 0; i < this.#itemsTrack; i++) {
        if(predicate.call(thisArg, this.#buffer[i], i, this)) return true;
      }

      return false;
    }

    public filter<S extends T>(predicate: VecPredicate<T, S>, thisArg?: any): Vec<S>;
    public filter(predicate: WeakVecPredicate<T>, thisArg?: any): Vec<T>;
    public filter<S extends T>(predicate: VecPredicate<T, S> | WeakVecPredicate<T>, thisArg?: any): Vec<T> | Vec<S> {
      if(this.#locked || this.#frozen) {
        throw new PrimitiveException('Cannot filter an frozen `Vec`', 'ERR_RESOURCE_FORZEN');
      }

      const filteredItems = [] as T[];

      for(let i = 0; i < this.#itemsTrack; i++) {
        if(predicate.call(thisArg, this.#buffer[i], i, this)) {
          filteredItems.push(this.#buffer[i]);
        }
      }

      return new Vec(filteredItems);
    }

    public find<S extends T>(predicate: VecPredicate<T, S>, thisArg?: any): S | undefined;
    public find(predicate: WeakVecPredicate<T>, thisArg?: any): T | undefined;
    public find<S extends T>(predicate: VecPredicate<T, S> | WeakVecPredicate<T>, thisArg?: any): S | T | undefined {
      for(let i = 0; i < this.#itemsTrack; i++) {
        if(predicate.call(thisArg, this.#buffer[i], i, this)) return this.#buffer[i];
      }

      return undefined;
    }

    public findIndex(predicate: WeakVecPredicate<T>, thisArg?: any): number {
      for(let i = 0; i < this.#itemsTrack; i++) {
        if(predicate.call(thisArg, this.#buffer[i], i, this)) return i;
      }

      return -1;
    }

    public flat<D extends number = 1>(depth?: D): Vec<FlatArray<T[], D>> {
      if(this.#locked || this.#frozen) {
        throw new PrimitiveException('Cannot flat an frozen `Vec`', 'ERR_RESOURCE_FORZEN');
      }

      return new Vec<FlatArray<T[], D>>(this.#buffer.slice(0, this.#itemsTrack).flat(depth));
    }

    public flatMap<U>(callback: (value: T, index: number, arr: T[]) => U | ReadonlyArray<U>, thisArg?: any): Vec<U> {
      if(this.#locked || this.#frozen) {
        throw new PrimitiveException('Cannot flat an frozen `Vec`', 'ERR_RESOURCE_FORZEN');
      }

      return new Vec( this.#buffer.slice(0, this.#itemsTrack).flatMap(callback, thisArg) );
    }

    public includes(needle: T, fromIndex?: number): boolean {
      for(let i = fromIndex || 0; i < this.#itemsTrack; i++) {
        if(this.#buffer[i] === needle) return true;
      }

      return false;
    }

    public indexOf(needle: T, fromIndex?: number): number {
      for(let i = fromIndex || 0; i < this.#itemsTrack; i++) {
        if(this.#buffer[i] === needle) return i;
      }

      return -1;
    }

    public lastIndexOf(needle: T, fromIndex?: number): number {
      let index = -1;

      for(let i = fromIndex || 0; i < this.#itemsTrack; i++) {
        if(this.#buffer[i] === needle) {
          index = i;
        }
      }

      return index;
    }

    public keys(): Iterator<number> {
      const arr = [] as number[];

      for(let i = 0; i < this.#itemsTrack; i++) {
        arr.push(i);
      }

      return new Iterator(arr);
    }

    public pop(): T | undefined {
      if(this.#locked || this.#frozen) {
        throw new PrimitiveException('Cannot remove items from an frozen `Vec`', 'ERR_RESOURCE_FORZEN');
      }

      const item = this.#buffer[this.#itemsTrack - 1];
      delete this.#buffer[--this.#itemsTrack];

      return item;
    }

    public reduce(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, vec: Vec<T>) => T): T;
    public reduce(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, vec: Vec<T>) => T, initialValue: T): T;
    public reduce<U>(callbackfn: (previousValue: U, currentValue: T, currentIndex: number, vec: Vec<T>) => U, initialValue: U): U;
    public reduce<U>(callbackfn: (prev: T | U, current: T, index: number, vec: Vec<T>) => T | U, initialValue?: T | U): T | U {
      if(this.#locked || this.#frozen) {
        throw new PrimitiveException('Cannot reduce an frozen `Vec`', 'ERR_RESOURCE_FORZEN');
      }

      let result: T | U = initialValue!;

      for(let i = 0; i < this.#itemsTrack; i++) {
        result = callbackfn(result, this.#buffer[i], i, this);
      }

      return result;
    }

    public reduceRight(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, vec: Vec<T>) => T): T;
    public reduceRight(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, vec: Vec<T>) => T, initialValue: T): T;
    public reduceRight<U>(callbackfn: (previousValue: U, currentValue: T, currentIndex: number, vec: Vec<T>) => U, initialValue: U): U;
    public reduceRight<U>(callbackfn: (prev: T | U, current: T, index: number, vec: Vec<T>) => T | U, initialValue?: T | U): T | U {
      if(this.#locked || this.#frozen) {
        throw new PrimitiveException('Cannot reduce an frozen `Vec`', 'ERR_RESOURCE_FORZEN');
      }

      let result: T | U = initialValue!;

      for(let i = this.#itemsTrack - 1; i > 0 ; i--) {
        result = callbackfn(result, this.#buffer[i], i, this);
      }

      return result;
    }

    public reverse(): Vec<T> {
      if(this.#locked || this.#frozen) {
        throw new PrimitiveException('Cannot reverse an frozen `Vec`', 'ERR_RESOURCE_FORZEN');
      }

      return new Vec( this.#buffer.slice(0, this.#itemsTrack).reverse() );
    }

    public shift(): T | undefined {
      if(this.#locked || this.#frozen) {
        throw new PrimitiveException('Cannot remove items from an frozen `Vec`', 'ERR_RESOURCE_FORZEN');
      }
      
      const result = this.#buffer[0];
      if(result === void 0) return result;

      for(let i = 0; i < this.#itemsTrack; i++) {
        this.#buffer[i] = this.#buffer[i + 1];
      }

      this.#itemsTrack--;
      return result;
    }

    public slice(start?: number, end?: number): Vec<T> {
      if(!start) return new Vec([ ...this.#buffer ]);

      if(!end) {
        end = this.#itemsTrack;
      }

      const items = [] as T[];

      for(let i = math.clamp(start, 0, this.#itemsTrack); i < math.clamp(end, 0, this.#itemsTrack); i++) {
        items.push(this.#buffer[i]);
      }

      return new Vec(items);
    }

    public sort(comparator?: (a: T, b: T) => number): Vec<T> {
      if(this.#locked || this.#frozen) {
        throw new PrimitiveException('Cannot sort an frozen `Vec`', 'ERR_RESOURCE_FORZEN');
      }
      
      return new Vec( this.#buffer.slice(0, this.#itemsTrack).sort(comparator) );
    }

    public splice(start: number, count?: number): Vec<T>;
    public splice(start: number, count: number, ...items: T[]): Vec<T>;
    public splice(start: number, count?: number, ...items: T[]): Vec<T> {
      if(this.#locked || this.#frozen) {
        throw new PrimitiveException('Cannot splice an frozen `Vec`', 'ERR_RESOURCE_FORZEN');
      }

      return new Vec( this.#buffer.slice(0, this.#itemsTrack).splice(start, count || 1, ...items) );
    }
  
    public iterator(): Iterator<T> {
      return new Iterator(this.#buffer);
    }
  
    public freeze(): void {
      this.#frozen = true;
    }
  
    public lock(): this {
      this.#locked = true;
      return this;
    }
  
    public unlock(): this {
      this.#locked = false;
      return this;
    }
  
    public toArray(): T[] {
      return this.#buffer.slice(0, this.#itemsTrack);
    }

    #isValid(arg: any): boolean {
      if(!this.#strictDataType) return true;

      if(typeof this.#strictDataType === 'function') {
        const result = this.#strictDataType(arg);

        if(isThenable(result)) {
          throw new PrimitiveException('The result of `Vec` data validator should be synchronous', 'ERR_UNEXPECTED_PROMISE');
        }

        if(typeof result !== 'boolean') {
          throw new PrimitiveException('The result of `Vec` data validator should be boolean', 'ERR_INVALID_TYPE');
        }

        return result;
      }

      switch(this.#strictDataType) {
        case 'integer':
          return typeof arg === 'number' && Number.isInteger(arg);
        case 'decimal':
          return typeof arg === 'number' && !Number.isInteger(arg);
        case 'array':
          return Array.isArray(arg);
        case 'struct':
          return typeof arg === 'object' && !Array.isArray(arg) && isPlainObject(arg);
        default:
          return typeof arg === this.#strictDataType;
      }
    }

    #assertDataType(arg: any): void {
      if(!this.#isValid(arg)) {
        throw new PrimitiveException(`Cannot handle 'typeof ${typeof arg}' in ${typeof this.#strictDataType === 'string' ? ('\'' + this.#strictDataType + '\'') : ''} in \`Vec\``, 'ERR_INVALID_ARGUMENT');
      }
    }
  }

  export class str {
    public static format(template: string, ...args: any): string {
      void args;
      return template;
    }
  }


  export namespace Exception {
    export namespace StackTrace {
      export class StackFrame extends StackTraceFrame { }
      
      export class StackTrace {
        public static create(): StackTrace {
          return new StackTrace(new Error().stack || '');
        }
      
        public static parse(value: string): StackTrace {
          return new StackTrace(value);
        }
      
        public static parseFrames(stack: string | StackTrace): readonly StackFrame[] {
          if(stack instanceof StackTrace) return Object.freeze( StackTrace.#parseFrames(stack.toString(false)) );
          return Object.freeze( StackTrace.#parseFrames(stack) );
        }
      
        public readonly frames: readonly StackFrame[];
      
        private constructor(public readonly value: string) {
          this.frames = StackTrace.#parseFrames(value);
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
      
        static #parseFrames(stack: string): StackFrame[] {
          const lines = stack.split('\n').slice(2); // Skip the first two lines (Error + message)
          const frames: StackFrame[] = [];
      
          for(let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(/^\s*at\s+(?:(.+?)\s+\()?(.+):(\d+):(\d+)\)?$/);
      
            if(match) {
              const [, origin, filename, lineNum, colNum] = match;
      
              frames.push( new StackFrame(
                filename,
                parseInt(colNum, 10),
                parseInt(lineNum, 10),
                undefined,
                line,
                undefined,
                origin || undefined,
                line.includes('[native code]'),
                origin?.includes('new ') || false,
                i === 0 // eslint-disable-line comma-dangle
              ) );
            }
          }
      
          return frames;
        }
      }
    }

    export class Throwable extends ThrowableException { }
    export class InvalidArgument extends InvalidArgumentException { }

    export interface AbstractErrorObject extends ExceptionObject { }

    export const toErrorCode = _toErrorCode;
    export const isException = isThrowableException;
    export const describeError = getErrorDescription;
    export const stringifyErrorCode = _stringifyErrorCode;
    export const ERROR_CODES = createEnum('NO_ERROR', 'ERR_UNKNOWN_ERROR', 'ERR_INVALID_ARGUMENT');
  }
}

export default IOStream;
