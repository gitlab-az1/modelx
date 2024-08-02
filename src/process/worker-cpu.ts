import { Either } from '../@internals/either';
import { ProcessExecutor, Processor, ProcessorType } from './core';


export class WorkerCPUProcessor implements Processor {
  public get $type(): ProcessorType {
    return ProcessorType.CPU;
  }

  public call<R, T>(executor: ProcessExecutor<R, T>, ctx: T): Promise<Either<Error, R>> {
    return this.#callAsync(executor, ctx);
  }

  #callAsync<R, T>(executor: ProcessExecutor<R, T>, ctx: T): Promise<Either<Error, R>> {
    return void executor, ctx as never;
  }
}

export default WorkerCPUProcessor;
