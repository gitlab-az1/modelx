import { doHash, isPlainObject } from './@internals/util';
import { Exception } from './@internals/errors';


const $size = Symbol('MAP::INTERNAL_DESCRIPTOR.Size');
const $clearCount = Symbol('MAP::INTERNAL_DESCRIPTOR.ClearCount');
const $bucket = Symbol('MAP::INTERNAL_DESCRIPTOR.Bucket');
const $capacity = Symbol('MAP::INTERNAL_DESCRIPTOR.Capacity');


function hashKey(key: any, c: number): number {
  return doHash(key) % c;
}


export class HashMap<K, V> {
  private [$capacity]: number;
  private [$bucket]: [K, V][][];
  private [$size]: number = 0;
  private [$clearCount]: number = 0;

  public constructor(_capacity: number = 32) {
    if(typeof _capacity === 'number' && !Number.isInteger(_capacity)) {
      throw new Exception(`Capacity of HashMap must be an integer, received ${_capacity}`, 'ERR_INVALID_ARGUMENT');
    }

    if(typeof _capacity === 'number' && !Number.isFinite(_capacity)) {
      throw new Exception(`Capacity of HashMap must be a finite number, received ${_capacity}`, 'ERR_INVALID_ARGUMENT');
    }

    this[$capacity] = typeof _capacity === 'number' && _capacity > 2
      ? _capacity :
      32;

    this[$bucket] = new Array(this[$capacity]);
  }

  public get size(): number {
    return this[$size];
  }

  public set(key: K, value: V): this {
    const hash = hashKey(key, this[$capacity]);
    
    if(typeof this[$bucket][hash] === 'undefined') {
      this[$bucket][hash] = [ [key, value] ];
      this[$size]++;
    } else {
      let found = false;

      for(let i = 0; i < this[$bucket][hash].length; i++) {
        if(this[$bucket][hash][i][0] !== key) continue;
        
        this[$bucket][hash][i][1] = value;
        found = true;

        break;
      }

      if(!found) {
        this[$bucket][hash].push([key, value]);
        this[$size]++;
      }
    }

    return this;
  }

  public get(key: K): V | undefined {
    const hash = hashKey(key, this[$capacity]);
    if(typeof this[$bucket][hash] === 'undefined') return undefined;

    for(let i = 0; i < this[$bucket][hash].length; i++) {
      if(this[$bucket][hash][i][0] === key) return this[$bucket][hash][i][1];
    }

    return undefined;
  }

  public has(key: K): boolean {
    const hash = hashKey(key, this[$capacity]);
    if(typeof this[$bucket][hash] === 'undefined') return false;

    for(let i = 0; i < this[$bucket][hash].length; i++) {
      if(this[$bucket][hash][i][0] === key) return true;
    }

    return false;
  }

  public delete(key: K): boolean {
    let removed = false;
    const hash = hashKey(key, this[$capacity]);

    if(this[$bucket][hash].length === 1 && this[$bucket][hash][0][0] === key) {
      delete this[$bucket][hash];
      removed = true;
      this[$size]--;
    } else {
      for(let i = 0; i < this[$bucket][hash].length; i++) {
        if(this[$bucket][hash][i][0] !== key) continue;

        delete this[$bucket][hash][i];
        removed = true;
        this[$size]--;

        break;
      }
    }

    return removed;
  }

  public clear() {
    this[$bucket] = null!;
    this[$bucket] = new Array(this[$capacity]);
    this[$size] = 0;
    this[$clearCount]++;
  }

  public *entries(): IterableIterator<[K, V]> {
    for(let i = 0; i < this[$bucket].length; i++) {
      if(typeof this[$bucket][i] === 'undefined') continue;

      for(let j = 0; j < this[$bucket][i].length; j++) {
        yield this[$bucket][i][j];
      }
    }
  }

  public *keys(): IterableIterator<K> {
    for(let i = 0; i < this[$bucket].length; i++) {
      if(typeof this[$bucket][i] === 'undefined') continue;

      for(let j = 0; j < this[$bucket][i].length; j++) {
        yield this[$bucket][i][j][0];
      }
    }
  }

  public *values(): IterableIterator<V> {
    for(let i = 0; i < this[$bucket].length; i++) {
      if(typeof this[$bucket][i] === 'undefined') continue;

      for(let j = 0; j < this[$bucket][i].length; j++) {
        yield this[$bucket][i][j][1];
      }
    }
  }

  public forEach(callbackfn: (value: V, key: K, map: HashMap<K, V>) => void, thisArg?: any): void {
    for(let i = 0; i < this[$bucket].length; i++) {
      if(typeof this[$bucket][i] === 'undefined') continue;

      for(let j = 0; j < this[$bucket][i].length; j++) {
        callbackfn.call(thisArg, this[$bucket][i][j][1], this[$bucket][i][j][0], this);
      }
    }
  }

  public *[Symbol.iterator](): IterableIterator<[K, V]> {
    for(let i = 0; i < this[$bucket].length; i++) {
      if(typeof this[$bucket][i] === 'undefined') continue;

      for(let j = 0; j < this[$bucket][i].length; j++) {
        yield this[$bucket][i][j];
      }
    }
  }

  public [Symbol.toStringTag](): string {
    return '[object HashMap]';
  }
}


export class ReadonlyMap<K, V> {
  readonly #map: HashMap<K, V>;

  public constructor(items: Map<K, V> | [K, V][] | { [key: string | number | symbol]: V } | HashMap<K, V>) {
    const entries = Array.isArray(items) ? items : [];

    if(items instanceof Map) {
      items.forEach((value, key) => {
        entries.push([key, value]);
      });
    } else if(items instanceof HashMap) {
      items.forEach((value, key) => {
        entries.push([key, value]);
      });
    } else if(typeof items === 'object' && isPlainObject(items)) {
      for(const key in items) {
        entries.push([key as any, (items as any)[key]]);
      }
    } else {
      throw new Exception('Invalid argument for ReadonlyMap constructor', 'ERR_INVALID_ARGUMENT');
    }

    this.#map = new HashMap(entries.length);

    for(const [key, value] of entries) {
      this.#map.set(key, value);
    }
  }

  public get size(): number {
    return this.#map.size;
  }

  public get(key: K): V | undefined {
    return this.#map.get(key);
  }

  public has(key: K): boolean {
    return this.#map.has(key);
  }

  public entries(): IterableIterator<[K, V]> {
    return this.#map.entries();
  }

  public keys(): IterableIterator<K> {
    return this.#map.keys();
  }

  public values(): IterableIterator<V> {
    return this.#map.values();
  }

  public forEach(callback: (value: V, key: K) => void): void {
    this.#map.forEach(callback);
  }

  public *[Symbol.iterator](): IterableIterator<[K, V]> {
    yield* this.#map;
  }

  public [Symbol.toStringTag](): string {
    return '[object ReadonlyMap]';
  }
}
