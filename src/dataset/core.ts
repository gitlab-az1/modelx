import { Exception } from '../@internals/errors';
import type { MaybePromise } from '../@internals/types';
import { AbstractIterator, LazyIterator } from '../@internals/iterator';


export abstract class AbstractDataset<T> {
  public abstract iterator(): MaybePromise<AbstractIterator<unknown>>;
  public abstract readonly size: number;

  public abstract concat(...superItems: AbstractDataset<T>[]): AbstractDataset<T>;
}



export class Dataset<T = any> extends AbstractDataset<T> {
  #header?: string[];
  #data: T[];

  public constructor(
    _rows: T[],
    _header?: string[] // eslint-disable-line comma-dangle
  ) {
    if(!!_header && _header.length !== _rows.length) {
      if(_header.length < _rows.length) {
        throw new Exception('Cannot initialize a dataset with more columns than in the header', 'ERR_INVALID_ARGUMENT');
      }

      while(_rows.length !== _header.length) {
        _rows.push(null!);
      }
    }

    super();
    
    this.#data = _rows;
    this.#header = _header;
  }

  public get size(): number {
    return this.#data.length;
  }

  public concat(...items: Dataset<T>[]): Dataset<T> {
    const headers = this.#header ?
      [...this.#header].concat(...(items.map(item => item.#header).filter(Boolean) || []) as unknown as string[])
      : undefined;

    const rows = [...this.#data].concat(...items.map(item => item.#data));

    return new Dataset(rows, headers);
  }

  public iterator(): LazyIterator<[header: string | null, data: T]> {
    const ir = [];

    for(let i = 0; i < this.#data.length; i++) {
      ir.push([
        this.#header ? this.#header[i] : null,
        this.#data[i],
      ]);
    }

    return new LazyIterator(ir as any);
  }
}
