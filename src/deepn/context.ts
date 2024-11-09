import type { CpuInfo, NetworkInterfaceInfo } from 'os';

import type { Dict } from '../types';
import { Exception } from '../@internals/errors';
import { constant, getvar, variable } from './kernel/vars';
import { asizeof, DeepAbstractArray } from './kernel/array';
import { _interopRequireDefault } from './kernel/node-require';


export interface NetworkInterface {
  readonly deviceName: string;
  readonly interfaces: readonly NetworkInterfaceInfo[];
}

export interface OSContext {
  readonly hostname: string;
  readonly loadAvg: readonly number[];
  readonly upTime: number;
  readonly freeMemory: number;
  readonly memory: number;
  readonly cpuCores: readonly CpuInfo[];
  readonly paralellism: number;
  readonly type: string;
  readonly release: string;
  readonly networkInterfaces: readonly NetworkInterface[];
  readonly devNull: string;
  readonly EOL: string;
  readonly arch: string;
  readonly version: string;
  readonly platform: NodeJS.Platform;
  readonly machine: string;
  readonly temporaryDirectory: string;
  readonly endianness: 'BE' | 'LE';
}


export function operatingSystem(): OSContext {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const m = _interopRequireDefault<typeof import('os')>(require('os')).default;

    const networkInterfaces: NetworkInterface[] = [];
    const availableNetworkInterfaces = m.networkInterfaces();

    for(const name in availableNetworkInterfaces) {
      networkInterfaces.push({
        deviceName: name,
        interfaces: Object.freeze(availableNetworkInterfaces[name]!),
      });
    }

    return Object.freeze<OSContext>({
      hostname: m.hostname(),
      arch: m.arch(),
      cpuCores: m.cpus(),
      devNull: m.devNull,
      endianness: m.endianness(),
      EOL: m.EOL,
      freeMemory: m.freemem(),
      loadAvg: m.loadavg(),
      machine: m.machine(),
      memory: m.totalmem(),
      paralellism: m.availableParallelism(),
      platform: m.platform(),
      release: m.release(),
      temporaryDirectory: m.tmpdir(),
      type: m.type(),
      upTime: m.uptime(),
      version: m.version(),
      networkInterfaces: Object.freeze(networkInterfaces),
    });
  } catch (err: any) {
    console.error(err);
    throw new Exception('Failed to fetch operating system informations from your machine', 'ERR_UNSUPPORTED_OPERATION');
  }
}

export interface ExecutionContext {
  getvar: typeof getvar;
  variable: typeof variable;
  constant: typeof constant;
  os(): OSContext;
  readonly environment: Dict<string | undefined>;
  readonly argc: number;
  readonly argv: DeepAbstractArray<string>;
  readonly startedAt: number;
}


const DEFAULT_ENV: Dict<string | undefined> = {
  // 
};

type WorkerContextProps = {
  args?: string[];
  env?: Dict<string | undefined>;
}

class WorkerContext {
  private _env: Map<string, string | undefined>;
  private readonly _startedAt: Date = new Date(Date.now());
  private readonly _arguments: DeepAbstractArray<string>;

  public constructor(props: WorkerContextProps = {}) {
    this._env = new Map();
    this._arguments = DeepAbstractArray.fromIterable(props.args || [], false).freeze();

    for(const [key, value] of Object.entries(Object.assign({}, DEFAULT_ENV, props.env))) {
      this._env.set(key, value);
    }
  }

  public context(): ExecutionContext {
    return Object.freeze<ExecutionContext>({
      startedAt: this._startedAt.getTime(),
      os: operatingSystem,
      environment: Object.fromEntries(this._env.entries()),
      argc: asizeof(this._arguments),
      argv: this._arguments,
      constant,
      variable,
      getvar,
    });
  }
}


const context = new WorkerContext({
  args: process?.argv.slice(2),
  env: process?.env,
});

export default context;
