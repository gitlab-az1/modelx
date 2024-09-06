const $chunksQueue = Symbol('WEAK_STREAM::INTERNAL_DESCRIPTOR.ChunksQueue');
const $isFollowing = Symbol('WEAK_STREAM::INTERNAL_DESCRIPTOR.IsFollowing');


export type ReadableInit<T> = {
  objectMode?: boolean;
  highWaterMark?: number;
  read?(this: WeakReadable<T>, size: number): void;
  destroy?(this: WeakReadable<T>, error: Error | null, callback: (error: Error | null) => void): void;
}

export class WeakReadable<T = any> {
  private [$isFollowing]: boolean;
  private readonly [$chunksQueue]: (T | null)[];

  public constructor(_options?: ReadableInit<T>) {
    void _options;
    this[$isFollowing] = false;
    this[$chunksQueue] = [];
  }

  public push(chunk: T | null): boolean {
    this[$chunksQueue].push(chunk);

    if(this[$isFollowing]) {
      //
    }

    return true;
  }
}
