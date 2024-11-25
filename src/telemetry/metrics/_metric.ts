import { SyncInstrument, type RecordType } from '../instruments';


export abstract class SyncMetric<T = unknown, Type extends RecordType = 'override'> extends SyncInstrument<Type, T> {
  public abstract readonly name: string;
  public abstract readonly description: string | null;

  public abstract collect(): T;
}

export default SyncMetric;
