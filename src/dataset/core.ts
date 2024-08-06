import type { MaybePromise } from '../@internals/types';
import { AbstractIterator } from '../@internals/iterator';


export abstract class AbstractDataset<T> {
  public abstract iterator(): MaybePromise<AbstractIterator<unknown>>;
  public abstract readonly size: number;

  public abstract concat(...superItems: AbstractDataset<T>[]): AbstractDataset<T>;
}
