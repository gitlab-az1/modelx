import IOStream from '../io';
import { uuid } from '../@internals/id';
import { Exception } from '../@internals/errors';


export type RecordType = 'override' | 'aggregate' | 'join';

export interface Attributes {
  [key: string]: string | number | boolean | null | undefined | (string | number | boolean | null | undefined)[];
}

type InstrumentResult<T extends RecordType, V = unknown> = (
  T extends 'override' ?
    { value: V; attributes: Attributes } :
  T extends 'aggregate' ?
    { value: V[]; attributes: Attributes[] } :
  never
);


type InstrumentState = {
  recordType: RecordType;
  value: any;
  attributes: Attributes[];
}

export abstract class SyncInstrument<Type extends RecordType, TValue = unknown> {
  readonly #id: string;
  readonly #state: InstrumentState;

  public constructor(rtype: Type) {
    this.#id = uuid();

    this.#state = {
      recordType: rtype,
      attributes: [],
      value: 0,
    };
  }

  public get instrumentId(): string {
    return this.#id.slice(0);
  }

  protected _record(value: TValue, attributes?: Attributes): void {
    switch(this.#state.recordType) {
      case 'override':
        this.#state.value = value;
        this.#state.attributes = [attributes || {}];
        break;
      case 'aggregate':
        if(!Array.isArray(this.#state.value)) {
          throw new Exception('Cannot aggreate a non-array method', 'ERR_INVALID_ARGUMENT');
        }

        this.#state.value.push(value);
        this.#state.attributes.push(attributes || {});
        break;
      default:
        throw new IOStream.Exception.NotImplemented('SyncInstrument#_record()', [value, attributes]);
    }
  }

  protected _read(): InstrumentResult<Type> {
    switch(this.#state.recordType) {
      case 'override':
        return { value: this.#state.value, attributes: this.#state.attributes[0] } as any;
      case 'aggregate':
        return { value: this.#state.value, attributes: this.#state.attributes } as any;
      default:
        throw new IOStream.Exception.NotImplemented('SyncInstrument#_read()');
    }
  }
}

export default SyncInstrument;
