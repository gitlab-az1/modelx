export {
  ArrayValues,
  Dict,
  GenericFunction,
  Interval,
  LooseAutocomplete,
  MaybeArray,
  MaybePromise,
  ObjectKeys,
  ObjectValues,
  PrimitiveDataType,
  Writable,
  BinaryHolder,
  PrimitiveDictionary,
} from './@internals/types';


export type DeepPartial<T> = (
  // eslint-disable-next-line @typescript-eslint/ban-types
  T extends Function ?
    T :
    T extends Array<infer InferredArrayMember> ?
      DeepPartialArray<InferredArrayMember> :
      T extends object ?
      DeepPartialObject<T> :
      T | undefined
);

interface DeepPartialArray<T> extends Array<DeepPartial<T>> { }

type DeepPartialObject<T> = {
  [K in keyof T]?: DeepPartial<T[K]>;
};
