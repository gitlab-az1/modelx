// import { Pair } from '../../pair';
// import { ISnapshot } from './snap';
// import { Exception } from '../../@internals/errors';


// export const enum PROCESS_STATUS {
//   UNINITIALIZED = 0x0,
//   ERROR = 0x1,
//   RUNNING = 0xA,
//   FULFILLED = 0xD,
// }


// export interface Process {
//   readonly processId: string;
//   readonly PID: number;
//   readonly status: PROCESS_STATUS;
//   readonly isFork: boolean;
//   readonly childrenProcessIdentifiers: readonly number[];
// }


// export function buildCommand(input: string | string[], args?: string[]): Pair<string, string[]> {
//   const validArgs = Array.isArray(args) && args.every(item => typeof item === 'string') ? args : [];
//   if(typeof input === 'string') return new Pair(input, validArgs);

//   if(!Array.isArray(input) || !input.every(item => typeof item === 'string')) {
//     throw new Exception(`Cannot start a process with unknown 'typeof ${typeof input}' command`, 'ERR_INVALID_PROCESS_CMD');
//   }

//   const [cmd, ...remainingInput] = input;

//   if(!cmd) {
//     throw new Exception('Failed to find process entry point', 'ERR_INVALID_ARGUMENT');
//   }

//   const combinedArgs = Array.from(new Set([...remainingInput, ...validArgs]));
//   return new Pair(cmd, combinedArgs);
// }



// const $bind = Symbol('$bind');
// const $processCwd = Symbol('$processCwd');

// export type ProcessOptions = {
//   [$processCwd]: string;
//   cwd?: string;
//   verbose: boolean;
//   env: NodeJS.ProcessEnv;
//   shell: string | boolean;
//   prefix: string;
//   arguments?: readonly string[];
//   spawn: typeof import('child_process').spawn;
// }

// type Resolve = ((out: ProcessOutput) => void);
// type IO = import('child_process').StdioPipe | import('child_process').StdioNull;


// type InternalProcessState = {
//   fork: boolean;
//   fromCwd: string;
//   status: PROCESS_STATUS;
//   executableCommand: string;
//   executionArguments: readonly string[];
// }


// export class LazyProcess implements Process {
//   readonly #id: string;
//   readonly #pid: number;
//   readonly #cIds: Set<number>;
//   #state: InternalProcessState;

//   public constructor(command?: string | string[], options?: ProcessOptions);
//   public constructor(command?: string | string[], from?: string, options?: ProcessOptions);
//   public constructor(command?: string | string[], fromOrOptions?: string | ProcessOptions, options?: ProcessOptions) {
//     let fork = false;
//     let executableCommand: string;
//     let executionArguments: readonly string[];

//     const o = ((typeof fromOrOptions === 'string' ? options : fromOrOptions) || {}) as ProcessOptions;
//     const cwd = typeof fromOrOptions === 'string' ? fromOrOptions : o.cwd || o[$processCwd] || process.cwd();

//     if(!command) {
//       // handle fork process
//       executableCommand = `${process.argv[0]} ${process.argv[1]}`;
//       executionArguments = process.argv.slice(2);
//       fork = true;
//     } else {
//       [executableCommand, executionArguments] = buildCommand(command).toArray();
//     }

//     this.#state = {
//       status: PROCESS_STATUS.UNINITIALIZED,
//       executableCommand,
//       executionArguments,
//       fromCwd: cwd,
//       fork,
//     };
//   }

//   [$bind](
//     cmd: [ string, readonly string[] ],
//     cwd: string,
//     resolve: Resolve,
//     reject: Resolve,
//     options: ProcessOptions,
//   ): void {
//     if(this.#state.status !== PROCESS_STATUS.UNINITIALIZED) {
//       throw new Exception('Cannot bind properties from an initialized process', 'ERR_RESOURCE_ALREADY_INITIALIZED');
//     }

//     this.#state = {
//       ...this.#state,
//       executionArguments: cmd[1],
//       executableCommand: cmd[0],
//       fromCwd: cwd,
//     };
//   }

//   public get processId(): string {
//     return this.#id.slice(0);
//   }

//   public get PID(): number {
//     return this.#pid;
//   }

//   public get childrenProcessIdentifiers(): readonly number[] {
//     return Object.freeze([ ...this.#cIds ]);
//   }

//   public get status(): PROCESS_STATUS {
//     return this.#state.status;
//   }

//   public async start(): Promise<ISnapshot> {
//     // 
//   }

//   public async run(): Promise<ProcessOutput> {
//     // 
//   }

//   public async kill(): Promise<unknown> {
//     // 
//   }
// }


// export class ProcessPromise extends Promise<ProcessOutput> implements Process { }


// export class ProcessOutput { }
