import { type Option } from '../../option';
import { IDisposable } from '../../@internals/disposable';


export interface AgentProcessingResult<T = unknown, P = any> {
  readonly agentId: string;
  readonly result: Option<T>;
  readonly contextParameters?: P;
}


export abstract class Agent<TReturn = unknown, TParams = any> implements IDisposable {
  public readonly agentId: string;

  public abstract processRequest(params?: TParams): Promise<TReturn>;
  public abstract dispose(): void;
}

export default Agent;
