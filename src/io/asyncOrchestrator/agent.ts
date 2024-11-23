import { type Option } from '../../option';


export interface AgentProcessingResult<T = unknown> {
  readonly result: Option<T>;
}


export abstract class Agent<TReturn = unknown, TParams = any> {
  public abstract processRequest(params?: TParams): Promise<TReturn>;
}

export default Agent;
