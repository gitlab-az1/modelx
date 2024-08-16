import { isThenable } from '../@internals/util';
import { env, setLastError } from '../environment';
import { Either, left, right } from '../@internals/either';
import { ProcessContext, type ProcessExecutor, Processor, ProcessorType } from './core';


export class InheritCPUProcessor implements Processor {
  readonly #startDate: Date;

  public constructor() {
    this.#startDate = new Date();
    void env;
  }

  public get $type(): ProcessorType {
    return ProcessorType.INHERIT;
  }

  public call<R, T>(executor: ProcessExecutor<R, T>, ctx?: T): Promise<Either<Error, R>> {
    return this.#callAsync(executor, ctx);
  }

  #callAsync<R, T>(executor: ProcessExecutor<R, T>, ctx?: T): Promise<Either<Error, R>> {
    const context = {
      $env: env(),
      $payload: ctx,
      processorType: 'cpu',
      stime: this.#startDate.getTime(),
    } satisfies ProcessContext<T>;

    return new Promise(resolve => {
      try {
        const result = executor(context);
        if(!isThenable<R>(result)) return void resolve(right(result));

        result
          .then(response => void resolve(right(response)))
          .catch(err => void resolve(left(err)));
      } catch (err: any) {
        setLastError(err);
        resolve(left(err));
      }
    });
  }
}

export default InheritCPUProcessor;
