import { ICancellationToken } from './cancellation';
import { DisposableStore, toDisposable } from './@internals/disposable-store';


/**
 * The payload that flows in readable stream events.
 */
export type ReadableStreamEventPayload<T> = T | Error | 'end';

export interface ReadableStreamEvents<T> {

	/**
	 * The 'data' event is emitted whenever the stream is
	 * relinquishing ownership of a chunk of data to a consumer.
	 *
	 * NOTE: PLEASE UNDERSTAND THAT ADDING A DATA LISTENER CAN
	 * TURN THE STREAM INTO FLOWING MODE. IT IS THEREFOR THE
	 * LAST LISTENER THAT SHOULD BE ADDED AND NOT THE FIRST
	 *
	 * Use `listenStream` as a helper method to listen to
	 * stream events in the right order.
	 */
	on(event: 'data', callback: (data: T) => void): void;

	/**
	 * Emitted when any error occurs.
	 */
	on(event: 'error', callback: (err: Error) => void): void;

	/**
	 * The 'end' event is emitted when there is no more data
	 * to be consumed from the stream. The 'end' event will
	 * not be emitted unless the data is completely consumed.
	 */
	on(event: 'end', callback: () => void): void;
}

/**
 * A interface that emulates the API shape of a node.js readable
 * stream for use in native and web environments.
 */
export interface ReadableStream<T> extends ReadableStreamEvents<T> {

	/**
	 * Stops emitting any events until resume() is called.
	 */
	pause(): void;

	/**
	 * Starts emitting events again after pause() was called.
	 */
	resume(): void;

	/**
	 * Destroys the stream and stops emitting any event.
	 */
	destroy(): void;

	/**
	 * Allows to remove a listener that was previously added.
	 */
	removeListener(event: string, callback: () => unknown): void;
}

/**
 * A interface that emulates the API shape of a node.js readable
 * for use in native and web environments.
 */
export interface Readable<T> {

	/**
	 * Read data from the underlying source. Will return
	 * null to indicate that no more data can be read.
	 */
	read(): T | null;
}


export function isReadable<T>(obj: unknown): obj is Readable<T> {
  const candidate = obj as Readable<T> | undefined;
  if (!candidate) {
    return false;
  }

  return typeof candidate.read === 'function';
}


/**
 * A interface that emulates the API shape of a node.js writeable
 * stream for use in native and web environments.
 */
export interface WriteableStream<T> extends ReadableStream<T> {

	/**
	 * Writing data to the stream will trigger the on('data')
	 * event listener if the stream is flowing and buffer the
	 * data otherwise until the stream is flowing.
	 *
	 * If a `highWaterMark` is configured and writing to the
	 * stream reaches this mark, a promise will be returned
	 * that should be awaited on before writing more data.
	 * Otherwise there is a risk of buffering a large number
	 * of data chunks without consumer.
	 */
	write(data: T): void | Promise<void>;

	/**
	 * Signals an error to the consumer of the stream via the
	 * on('error') handler if the stream is flowing.
	 *
	 * NOTE: call `end` to signal that the stream has ended,
	 * this DOES NOT happen automatically from `error`.
	 */
	error(error: Error): void;

	/**
	 * Signals the end of the stream to the consumer. If the
	 * result is provided, will trigger the on('data') event
	 * listener if the stream is flowing and buffer the data
	 * otherwise until the stream is flowing.
	 */
	end(result?: T): void;
}

/**
 * A stream that has a buffer already read. Returns the original stream
 * that was read as well as the chunks that got read.
 *
 * The `ended` flag indicates if the stream has been fully consumed.
 */
export interface ReadableBufferedStream<T> {

	/**
	 * The original stream that is being read.
	 */
	stream: ReadableStream<T>;

	/**
	 * An array of chunks already read from this stream.
	 */
	buffer: T[];

	/**
	 * Signals if the stream has ended or not. If not, consumers
	 * should continue to read from the stream until consumed.
	 */
	ended: boolean;
}


export function isReadableStream<T>(obj: unknown): obj is ReadableStream<T> {
  const candidate = obj as ReadableStream<T> | undefined;

  if(!candidate) return false;
  return [candidate.on, candidate.pause, candidate.resume, candidate.destroy].every(fn => typeof fn === 'function');
}

export function isReadableBufferedStream<T>(obj: unknown): obj is ReadableBufferedStream<T> {
  const candidate = obj as ReadableBufferedStream<T> | undefined;

  if(!candidate) return false;
  return isReadableStream(candidate.stream) && Array.isArray(candidate.buffer) && typeof candidate.ended === 'boolean';
}

export interface IReducer<T, R = T> {
	(data: T[]): R;
}

export interface IDataTransformer<Original, Transformed> {
	(data: Original): Transformed;
}

export interface IErrorTransformer {
	(error: Error): Error;
}

export interface ITransformer<Original, Transformed> {
	data: IDataTransformer<Original, Transformed>;
	error?: IErrorTransformer;
}


export interface WriteableStreamOptions {

	/**
	 * The number of objects to buffer before WriteableStream#write()
	 * signals back that the buffer is full. Can be used to reduce
	 * the memory pressure when the stream is not flowing.
	 */
	highWaterMark?: number;
}

class WriteableStreamImpl<T> implements WriteableStream<T> {

  private readonly _state = {
    flowing: false,
    ended: false,
    destroyed: false,
  };

  private readonly _buffer = {
    data: [] as T[],
    error: [] as Error[],
  };

  private readonly _listeners = {
    data: [] as { (data: T): void }[],
    error: [] as { (error: Error): void }[],
    end: [] as { (): void }[],
  };

  private readonly _pendingWritePromises: (() => unknown)[] = [];

  public constructor(private readonly _reducer: IReducer<T>, private readonly _options?: WriteableStreamOptions) { }

  public pause(): void {
    if(this._state.destroyed) return;
    this._state.flowing = false;
  }

  public resume(): void {
    if(this._state.destroyed) return;

    if(!this._state.flowing) {
      this._state.flowing = true;

      // emit buffered events
      this._flowData();
      this._flowErrors();
      this._flowEnd();
    }
  }

  public write(data: T): void | Promise<void> {
    if (this._state.destroyed) {
      return;
    }

    // flowing: directly send the data to listeners
    if (this._state.flowing) {
      this._emitData(data);
    }

    // not yet flowing: buffer data until flowing
    else {
      this._buffer.data.push(data);

      // highWaterMark: if configured, signal back when buffer reached limits
      if (typeof this._options?.highWaterMark === 'number' && this._buffer.data.length > this._options.highWaterMark) {
        return new Promise(resolve => this._pendingWritePromises.push(resolve));
      }
    }
  }

  public error(error: Error): void {
    if (this._state.destroyed) return;

    // flowing: directly send the error to listeners
    if (this._state.flowing) {
      this._emitError(error);
    }

    // not yet flowing: buffer errors until flowing
    else {
      this._buffer.error.push(error);
    }
  }

  public end(result?: T): void {
    if(this._state.destroyed) return;

    // end with data if provided
    if (typeof result !== 'undefined') {
      this.write(result);
    }

    // flowing: send end event to listeners
    if (this._state.flowing) {
      this._emitEnd();

      this.destroy();
    }

    // not yet flowing: remember state
    else {
      this._state.ended = true;
    }
  }

  private _emitData(data: T): void {
    this._listeners.data.slice(0).forEach(listener => listener(data)); // slice to avoid listener mutation from delivering event
  }

  private _emitError(error: Error): void {
    if(this._listeners.error.length === 0) {
      throw error; // nobody listened to this error so we log it as unexpected
    } else {
      this._listeners.error.slice(0).forEach(listener => listener(error)); // slice to avoid listener mutation from delivering event
    }
  }

  private _emitEnd(): void {
    this._listeners.end.slice(0).forEach(listener => listener()); // slice to avoid listener mutation from delivering event
  }

  public on(event: 'data', callback: (data: T) => void): void;
  public on(event: 'error', callback: (err: Error) => void): void;
  public on(event: 'end', callback: () => void): void;
  public on(event: 'data' | 'error' | 'end', callback: (arg0?: any) => void): void {
    if (this._state.destroyed) {
      return;
    }

    switch(event) {
      case 'data':
        this._listeners.data.push(callback);

        // switch into flowing mode as soon as the first 'data'
        // listener is added and we are not yet in flowing mode
        this.resume();

        break;

      case 'end':
        this._listeners.end.push(callback);

        // emit 'end' event directly if we are flowing
        // and the end has already been reached
        //
        // finish() when it went through
        if (this._state.flowing && this._flowEnd()) {
          this.destroy();
        }

        break;

      case 'error':
        this._listeners.error.push(callback);

        // emit buffered 'error' events unless done already
        // now that we know that we have at least one listener
        if (this._state.flowing) {
          this._flowErrors();
        }

        break;
    }
  }

  public removeListener(event: string, callback: () => unknown): void {
    if(this._state.destroyed) return;
    let listeners: unknown[] | undefined = undefined;

    switch(event) {
      case 'data':
        listeners = this._listeners.data;
        break;

      case 'end':
        listeners = this._listeners.end;
        break;

      case 'error':
        listeners = this._listeners.error;
        break;
    }

    if(listeners) {
      const index = listeners.indexOf(callback);

      if(index >= 0) {
        listeners.splice(index, 1);
      }
    }
  }

  private _flowData(): void {
    if(this._buffer.data.length > 0) {
      const fullDataBuffer = this._reducer(this._buffer.data);

      this._emitData(fullDataBuffer);
      this._buffer.data.length = 0;

      // When the buffer is empty, resolve all pending writers
      const pendingWritePromises = [...this._pendingWritePromises];
      this._pendingWritePromises.length = 0;
      pendingWritePromises.forEach(pendingWritePromise => pendingWritePromise());
    }
  }

  private _flowErrors(): void {
    if(this._listeners.error.length > 0) {
      for(const error of this._buffer.error) {
        this._emitError(error);
      }

      this._buffer.error.length = 0;
    }
  }

  private _flowEnd(): boolean {
    if(this._state.ended) {
      this._emitEnd();

      return this._listeners.end.length > 0;
    } else return false;
  }

  public destroy(): void {
    if (!this._state.destroyed) {
      this._state.destroyed = true;
      this._state.ended = true;

      this._buffer.data.length = 0;
      this._buffer.error.length = 0;

      this._listeners.data.length = 0;
      this._listeners.error.length = 0;
      this._listeners.end.length = 0;

      this._pendingWritePromises.length = 0;
    }
  }
}

/**
 * Helper to fully read a T readable into a T.
 */
export function consumeReadable<T>(readable: Readable<T>, reducer: IReducer<T>): T {
  const chunks: T[] = [];

  let chunk: T | null;
  while ((chunk = readable.read()) !== null) {
    chunks.push(chunk);
  }

  return reducer(chunks);
}

/**
 * Helper to read a T readable up to a maximum of chunks. If the limit is
 * reached, will return a readable instead to ensure all data can still
 * be read.
 */
export function peekReadable<T>(readable: Readable<T>, reducer: IReducer<T>, maxChunks: number): T | Readable<T> {
  const chunks: T[] = [];

  let chunk: T | null | undefined = undefined;
  while ((chunk = readable.read()) !== null && chunks.length < maxChunks) {
    chunks.push(chunk);
  }

  // If the last chunk is null, it means we reached the end of
  // the readable and return all the data at once
  if (chunk === null && chunks.length > 0) {
    return reducer(chunks);
  }

  // Otherwise, we still have a chunk, it means we reached the maxChunks
  // value and as such we return a new Readable that first returns
  // the existing read chunks and then continues with reading from
  // the underlying readable.
  return {
    read: () => {

      // First consume chunks from our array
      if (chunks.length > 0) {
        return chunks.shift()!;
      }

      // Then ensure to return our last read chunk
      if (typeof chunk !== 'undefined') {
        const lastReadChunk = chunk;

        // explicitly use undefined here to indicate that we consumed
        // the chunk, which could have either been null or valued.
        chunk = undefined;

        return lastReadChunk;
      }

      // Finally delegate back to the Readable
      return readable.read();
    },
  };
}

/**
 * Helper to fully read a T stream into a T or consuming
 * a stream fully, awaiting all the events without caring
 * about the data.
 */
export function consumeStream<T, R = T>(stream: ReadableStreamEvents<T>, reducer: IReducer<T, R>): Promise<R>;
export function consumeStream(stream: ReadableStreamEvents<unknown>): Promise<undefined>;
export function consumeStream<T, R = T>(stream: ReadableStreamEvents<T>, reducer?: IReducer<T, R>): Promise<R | undefined> {
  return new Promise((resolve, reject) => {
    const chunks: T[] = [];

    listenStream(stream, {
      onData: chunk => {
        if (reducer) {
          chunks.push(chunk);
        }
      },
      onError: error => {
        if (reducer) {
          reject(error);
        } else {
          resolve(undefined);
        }
      },
      onEnd: () => {
        if (reducer) {
          resolve(reducer(chunks));
        } else {
          resolve(undefined);
        }
      },
    });
  });
}

export interface IStreamListener<T> {

	/**
	 * The 'data' event is emitted whenever the stream is
	 * relinquishing ownership of a chunk of data to a consumer.
	 */
	onData(data: T): void;

	/**
	 * Emitted when any error occurs.
	 */
	onError(err: Error): void;

	/**
	 * The 'end' event is emitted when there is no more data
	 * to be consumed from the stream. The 'end' event will
	 * not be emitted unless the data is completely consumed.
	 */
	onEnd(): void;
}

/**
 * Helper to listen to all events of a T stream in proper order.
 */
export function listenStream<T>(stream: ReadableStreamEvents<T>, listener: IStreamListener<T>, token?: ICancellationToken): void {
  stream.on('error', error => {
    if(!token?.isCancellationRequested) {
      listener.onError(error);
    }
  });

  stream.on('end', () => {
    if(!token?.isCancellationRequested) {
      listener.onEnd();
    }
  });

  // Adding the `data` listener will turn the stream
  // into flowing mode. As such it is important to
  // add this listener last (DO NOT CHANGE!)
  stream.on('data', data => {
    if(!token?.isCancellationRequested) {
      listener.onData(data);
    }
  });
}

/**
 * Helper to peek up to `maxChunks` into a stream. The return type signals if
 * the stream has ended or not. If not, caller needs to add a `data` listener
 * to continue reading.
 */
export function peekStream<T>(stream: ReadableStream<T>, maxChunks: number): Promise<ReadableBufferedStream<T>> {
  return new Promise((resolve, reject) => {
    const streamListeners = new DisposableStore();
    const buffer: T[] = [];

    // Data Listener
    const dataListener = (chunk: T) => {

      // Add to buffer
      buffer.push(chunk);

      // We reached maxChunks and thus need to return
      if (buffer.length > maxChunks) {

        // Dispose any listeners and ensure to pause the
        // stream so that it can be consumed again by caller
        streamListeners.dispose();
        stream.pause();

        return resolve({ stream, buffer, ended: false });
      }
    };

    // Error Listener
    const errorListener = (error: Error) => {
      streamListeners.dispose();

      return reject(error);
    };

    // End Listener
    const endListener = () => {
      streamListeners.dispose();

      return resolve({ stream, buffer, ended: true });
    };

    streamListeners.add(toDisposable(() => stream.removeListener('error', errorListener as () => any)));
    stream.on('error', errorListener);

    streamListeners.add(toDisposable(() => stream.removeListener('end', endListener)));
    stream.on('end', endListener);

    // Important: leave the `data` listener last because
    // this can turn the stream into flowing mode and we
    // want `error` events to be received as well.
    streamListeners.add(toDisposable(() => stream.removeListener('data', dataListener as () => any)));
    stream.on('data', dataListener);
  });
}

/**
 * Helper to create a readable stream from an existing T.
 */
export function toStream<T>(t: T, reducer: IReducer<T>): ReadableStream<T> {
  const stream = newWriteableStream<T>(reducer);

  stream.end(t);

  return stream;
}

/**
 * Helper to create an empty stream
 */
export function emptyStream(): ReadableStream<never> {
  const stream = newWriteableStream<never>(() => { throw new Error('not supported'); });
  stream.end();

  return stream;
}

/**
 * Helper to convert a T into a Readable<T>.
 */
export function toReadable<T>(t: T): Readable<T> {
  let consumed = false;

  return {
    read: () => {
      if(consumed) return null;

      consumed = true;
      return t;
    },
  };
}


/**
 * Helper to transform a readable stream into another stream.
 */
export function transform<Original, Transformed>(stream: ReadableStreamEvents<Original>, transformer: ITransformer<Original, Transformed>, reducer: IReducer<Transformed>): ReadableStream<Transformed> {
  const target = newWriteableStream<Transformed>(reducer);

  listenStream(stream, {
    onData: data => target.write(transformer.data(data)),
    onError: error => target.error(transformer.error ? transformer.error(error) : error),
    onEnd: () => target.end(),
  });

  return target;
}

/**
 * Helper to take an existing stream that will
 * have a prefix injected to the beginning.
 */
export function prefixedStream<T>(prefix: T, stream: ReadableStream<T>, reducer: IReducer<T>): ReadableStream<T> {
  let prefixHandled = false;
  const target = newWriteableStream<T>(reducer);

  listenStream(stream, {
    onData: data => {

      // Handle prefix only once
      if(!prefixHandled) {
        prefixHandled = true;
        return target.write(reducer([prefix, data]));
      } else return target.write(data);
    },
    onError: error => target.error(error),
    onEnd: () => {

      // Handle prefix only once
      if(!prefixHandled) {
        prefixHandled = true;
        target.write(prefix);
      }

      target.end();
    },
  });

  return target;
}

export function newWriteableStream<T>(reducer: IReducer<T>, options?: WriteableStreamOptions): WriteableStream<T> {
  return new WriteableStreamImpl<T>(reducer, options);
}
