import fs from 'fs';
import { Readable } from 'stream';

import { HashMap } from '../map';
import { listenStream } from '../stream';
import { isThenable } from '../@internals/util';
import { Exception } from '../@internals/errors';
import { ChunkStream } from '../@internals/buffer';
import { parseSpecies } from '../authlib/database';
import type { PrimitiveDictionary } from '../types';
import { jsonSafeParser, jsonSafeStringify } from '../@internals/json';
import { type Option, optionalDefined, unwrapExpect } from '../option';
import { CancellationToken, ICancellationToken } from '../cancellation';


type WrappedJSONValue<T = any> = { value: T };

const BUFFERED_HEADER_ENDING_SEQUENCE = '\n-dd\n';
const BUFFERED_METADATA_ENDING_SEQUENCE = '\n-ee\n';
const BUFFERED_HEADER_ENDING_SEQUENCE_LENGTH = BUFFERED_HEADER_ENDING_SEQUENCE.length;
const BUFFERED_METADATA_ENDING_SEQUENCE_LENGTH = BUFFERED_METADATA_ENDING_SEQUENCE.length;


type StoreHeaders = PrimitiveDictionary & {
  // 
};

type StoreMetadata = PrimitiveDictionary & {
  //
};

type PartialWrappedStore = {
  readonly headers: StoreHeaders;
  readonly metadata: StoreMetadata;
  readonly payload: PrimitiveDictionary;
};


function consumeStoreStream(stream: Readable, token: ICancellationToken = CancellationToken.None): Promise<PartialWrappedStore> {
  const headerChunks = new ChunkStream();
  const metadataChunks = new ChunkStream();
  const payloadChunks = new ChunkStream();

  return new Promise((resolve, reject) => {
    token.onCancellationRequested(reject);

    listenStream<Buffer>(stream, {
      onError: reject,
      onData: chunk => {
        try {
          if(metadataChunks.byteLength === 0) {
            const headerEndIndex = chunk.indexOf(BUFFERED_HEADER_ENDING_SEQUENCE);

            if(headerEndIndex !== -1) {
              headerChunks.acceptChunk(chunk.subarray(0, headerEndIndex));
              metadataChunks.acceptChunk(chunk.subarray(headerEndIndex + BUFFERED_HEADER_ENDING_SEQUENCE_LENGTH));
            } else {
              headerChunks.acceptChunk(chunk);
            }
          } else if(payloadChunks.byteLength === 0) {
            const metadataEndIndex = chunk.indexOf(BUFFERED_METADATA_ENDING_SEQUENCE);

            if(metadataEndIndex !== -1) {
              metadataChunks.acceptChunk(chunk.subarray(0, metadataEndIndex));
              payloadChunks.acceptChunk(chunk.subarray(metadataEndIndex + BUFFERED_METADATA_ENDING_SEQUENCE_LENGTH));
            } else {
              metadataChunks.acceptChunk(chunk);
            }
          } else {
            payloadChunks.acceptChunk(chunk);
          }
        } catch (error: any) {
          stream.destroy();
          reject(new Exception(`Failed to process stream: ${error.message}`, 'ERR_STREAM_PROCESSING_FAILURE'));
        }
      },
      onEnd: () => {
        const h = headerChunks.end().toString().replace(BUFFERED_HEADER_ENDING_SEQUENCE, '');
        const m = metadataChunks.end().toString().replace(BUFFERED_METADATA_ENDING_SEQUENCE, '');

        const headers = ({} as unknown) as StoreHeaders;
        const metadata = ({} as unknown) as StoreMetadata;

        for(const row of h.split('\n')) {
          const [key, value] = row.split('=').map(item => decodeURIComponent(item.trim()));
          headers[key] = parseSpecies(value);
        }

        for(const row of m.split('\n')) {
          const [key, value] = row.split('=').map(item => decodeURIComponent(item.trim()));
          metadata[key] = parseSpecies(value);
        }

        const parsedPayload = jsonSafeParser<any>(decodeURIComponent( payloadChunks.end().toString() ));
        if(parsedPayload.isLeft()) return void reject(parsedPayload.value);

        resolve({
          headers,
          metadata,
          payload: parsedPayload.value,
        });
      },
    }, token);
  });
}


type StoreInitState = { }


export class HashMapStore<V extends string | number | boolean | null | { valueOf(): string }, K extends string | symbol | { valueOf(): string }> {
  public static async fromPath<V extends string | number | boolean | null | { valueOf(): string }, K extends string | symbol | { valueOf(): string }>(storePath: string): Promise<HashMapStore<V, K>> {
    if(!fs.existsSync(storePath)) {
      throw new Exception(`Faield to read hash-map store at '${storePath}'`, 'ERR_FILE_NOT_FOUND');
    }

    const stat = await fs.promises.stat(storePath);

    if(!stat.isFile()) {
      throw new Exception(`Cannot open hash-map store at '${storePath}' because it is not a file`, 'ERR_INVALID_TYPE');
    }

    const parsed = await consumeStoreStream(fs.createReadStream(storePath));
  }

  #wrappedMap: HashMap<string, string>;

  private constructor(_initState: StoreInitState) {
    this.#wrappedMap = new HashMap();
  }

  public set(key: K, value: V): Promise<boolean> {
    this.#wrappedMap.set(this.#extractKey(key),
      unwrapExpect(this.#wrapValue(value), `Failed to serialize 'typeof ${typeof value}' value`));

    return this.#saveCurrentState();
  }

  public get(key: K): V | undefined {
    const v = this.#wrappedMap.get( this.#extractKey(key) );
    if(!v) return undefined;

    const p = jsonSafeParser<WrappedJSONValue>(v);

    if(p.isLeft()) {
      throw p.value;
    }

    if(typeof p.value !== 'object' || !('value' in p.value)) {
      throw new Exception(`Failed to unwrap 'typeof ${typeof p.value}' as hashmap item`, 'ERR_UNSUPPORTED_OPERATION');
    }

    return p.value.value;
  }

  public contains(key: K): boolean {
    return this.#wrappedMap.has( this.#extractKey(key) );
  }

  public remove(key: K): Promise<boolean> {
    if(!this.#wrappedMap.delete( this.#extractKey(key) )) return Promise.resolve(false);
    return this.#saveCurrentState();
  }

  #wrapValue(value: V): Option<string> {
    return optionalDefined( jsonSafeStringify({ value }) );
  }

  #extractKey(key: K): string {
    if(!key) return '[NULL]';
    if(typeof key === 'string') return key;

    let result: string | null = null;

    if(typeof key === 'object' && typeof key.valueOf === 'function') {
      result = key.valueOf();

      if(isThenable(result)) {
        throw new Exception('The result of `$key.valueOf()` must be synchronous and return an string', 'ERR_UNEXPECTED_PROMISE');
      }
    }

    if(!result && typeof key === 'symbol') {
      result = key.description || key.toString();
    }

    if(!result) {
      throw new Exception(`Failed to unwrap 'typeof ${typeof key}' as hash-map key`, 'ERR_INVALID_ARGUMENT');
    }

    return result;
  }

  async #saveCurrentState(): Promise<boolean> {
    return false;
  }
}

export default HashMap;
