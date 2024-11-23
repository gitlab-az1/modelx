import { Disposable } from '@ts-overflow/node-framework/disposable';

import IOStream from '../index';
import { Exception } from '../../@internals/errors';
import { assertString } from '../../@internals/util';
import type { LooseAutocomplete } from '../../types';
import Agent, { AgentProcessingResult } from './agent';


export type LogEvent = 
  | '';


export interface OrchestratorOptions {
  overrideLogRules?: {
    include?: LogEvent[];
    omit?: LogEvent[];
  };

  maxRetries?: number;
  maxAttempts?: number;
  agentIdentifier?: string;
  useDefaultAgentIdentifier?: boolean;
  maxMessagePairsForAgent?: number;
}


type OrchestratorState = {
  disposed: boolean;
}

export class AsyncOrchestrator<T extends object = { [key: string]: [any, unknown] }> extends Disposable {
  readonly #State: OrchestratorState;
  // @ts-expect-error Property AsyncOrchestrator#RegisteredAgents is never readed
  readonly #RegisteredAgents: Map<string, Agent>;

  public constructor(options?: OrchestratorOptions) {
    throw new IOStream.Exception.NotImplemented('new AsyncOrchestrator()', [options]);
    super();

    this.#State = {
      disposed: false,
    };

    this.#RegisteredAgents = new Map();
  }

  public async callAsync<K extends keyof T>(
    agentId: LooseAutocomplete<K>,
    params?: T[K] extends any[] ? T[K][0] : T[K] // eslint-disable-line comma-dangle
  ): Promise<AgentProcessingResult<T[K] extends any[] ? T[K][1] : T[K]>> {
    throw new IOStream.Exception.NotImplemented('AsyncOrchestrator#callAsync()', [agentId, params]);
    if(this.#State.disposed) {
      throw new Exception('Cannot call an disposed orchestrator', 'ERR_RESOURCE_DISPOSED');
    }

    assertString(agentId);
    // const agent = this.#RegisteredAgents.get(agentId);

    // if(!agent) {
    // throw new Exception(`Could not find orchestrale agent '${agentId}'`, 'ERR_UNKNOWN_ERROR');
    // }

    // try {
    // const result = await agent.processRequest(params);
    // } catch (err: any) {
    // TODO: log error, build and return an empty response
    // }
  }

  public override dispose(): void {
    if(!this.#State.disposed) {
      //#

      this.#State.disposed = true;
    }

    super.dispose();
  }
}

export default AsyncOrchestrator;
