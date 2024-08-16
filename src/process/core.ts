import Environment from '../environment';
import { Either } from '../@internals/either';


export interface ProcessContext<C> {
  readonly $payload?: C;
  readonly stime: number;
  readonly $env: Environment;
  readonly processorType: Exclude<Lowercase<keyof typeof ProcessorType>, 'inherit'>;
}


export type ProcessExecutor<R, C> = (context: ProcessContext<C>) => R | Promise<R>;


export const enum ProcessorType {
  CPU = 0xFF,
  OPENGL = 0xA1,
  INHERIT = 0x5E,
}

export interface Processor {
  readonly $type: ProcessorType;
  call<TReturn, TContext>(executor: ProcessExecutor<TReturn, TContext>, ctx?: TContext): Promise<Either<Error, TReturn>>;
}
