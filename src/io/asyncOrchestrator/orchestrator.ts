import { Disposable } from '@ts-overflow/node-framework/disposable';

import IOStream from '../index';
import { Exception } from '../../@internals/errors';
import { assertString } from '../../@internals/util';
import type { LooseAutocomplete } from '../../types';
import Agent, { AgentProcessingResult } from './agent';
import { AbstractLogger } from '../../logger/transporters/core';


export type LogEvent = 
  | 'agent_processing_start'
  | 'agent_processing_end'
  | 'agent_processing_error'
  | 'orchestrator_disposing';


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
  logger?: AbstractLogger;
}


type OrchestratorState = {
  disposed: boolean;
}

export class AsyncOrchestrator<T extends object> extends Disposable {
  readonly #Logger: AbstractLogger;
  readonly #State: OrchestratorState;
  readonly #RegisteredAgents: Map<string, Agent>;

  public constructor(options?: OrchestratorOptions) {
    throw new IOStream.Exception.NotImplemented('new AsyncOrchestrator()', [options]);
    super();

    this.#State = {
      disposed: false,
    };

    this.#RegisteredAgents = new Map();
    this.#Logger = options?.logger || console;
  }

  public registerAgent(agent: Agent): void {
    if(this.#State.disposed) {
      throw new Exception('Cannot operate an disposed orchestrator', 'ERR_RESOURCE_DISPOSED');
    }

    if(this.#RegisteredAgents.has(agent.agentId)) {
      throw new Exception(`Cannot register agent '${agent.agentId}' twice`, 'ERR_UNSUPPORTED_OPERATION');
    }

    this.#RegisteredAgents.set(agent.agentId, agent);
  }

  public removeAgent(agent: string | Agent): boolean {
    if(this.#State.disposed) {
      throw new Exception('Cannot operate an disposed orchestrator', 'ERR_RESOURCE_DISPOSED');
    }

    const storedAgent = this.#RegisteredAgents.get(typeof agent === 'string' ? agent : agent.agentId);
    if(!storedAgent) return false;

    storedAgent.dispose();
    return true;
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
    super.dispose();

    if(!this.#State.disposed) {
      this.#RegisteredAgents.clear();

      if(typeof (this.#Logger as { dispose?: () => void }).dispose === 'function') {
        (this.#Logger as { dispose?: () => void }).dispose?.();
      }

      this.#State.disposed = true;
    }
  }
}

export default AsyncOrchestrator;
