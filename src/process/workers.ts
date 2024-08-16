// import { IDisposable } from '@ts-overflow/node-framework/disposable';
// import { EventEmitter, Event as BaseEvent } from '@ts-overflow/async/events';

// import type { Dict } from '../@internals/types';


// const WorkerInit = '__$__initialize';


// export type WorkerPostOptions = {
//   //
// };

// export interface IWorker extends IDisposable {
//   getId(): string;
//   postMessage(message: Message, options?: WorkerPostOptions): void;
//   postMessage(message: Message, transfer: ArrayBuffer[], options?: WorkerPostOptions): void;
// }


// const enum MessageType {
//   Request,
//   Reply,
//   Ack,
//   SubscribeEvent,
//   Event,
//   UnsubscribeEvent,
// }


// class RequestMessage<T = any> {
//   public constructor(
//     public readonly workerId: string,
//     public readonly request: string,
//     public readonly method: string,
//     public readonly args: T[] // eslint-disable-line comma-dangle
//   ) { }

//   public get type(): number {
//     return MessageType.Request;
//   }
// }

// class ReplyMessage<T = any, E = Error> {
//   public constructor(
//     public readonly workerId: string,
//     public readonly sequence: string,
//     public readonly response: T,
//     public readonly error?: E // eslint-disable-line comma-dangle
//   ) { }

//   public get type(): number {
//     return MessageType.Reply;
//   }
// }

// class AckMessage<E = Error> {
//   public constructor(
//     public readonly workerId: string,
//     public readonly sequence: string,
//     public readonly error?: E // eslint-disable-line comma-dangle
//   ) { }

//   public get type(): number {
//     return MessageType.Ack;
//   }
// }

// class SubscribeEventMessage<T = any> {
//   public constructor(
//     public readonly workerId: string,
//     public readonly request: string,
//     public readonly event: string,
//     public readonly arg: T // eslint-disable-line comma-dangle
//   ) { }

//   public get type(): number {
//     return MessageType.SubscribeEvent;
//   }
// }

// class UnsubscribeEventMessage {
//   public constructor(
//     public readonly workerId: string,
//     public readonly request: string // eslint-disable-line comma-dangle
//   ) { }

//   public get type(): number {
//     return MessageType.UnsubscribeEvent;
//   }
// }

// class EventMessage<T = any> {
//   public constructor(
//     public readonly workerId: string,
//     public readonly request: string,
//     public readonly event: T // eslint-disable-line comma-dangle
//   ) { }

//   public get type(): number {
//     return MessageType.Event;
//   }
// }


// export type Message = RequestMessage | ReplyMessage | AckMessage | SubscribeEventMessage | UnsubscribeEventMessage | EventMessage;

// export interface MessageReply<T = any, E = unknown> {
//   resolve(value?: T): void;
//   reject(error?: E): void;
// }

// export interface MessageHandler {
//   sendMessage(msg: any, transger?: ArrayBuffer[]): void;
//   handleMessage(method: string, args: any[]): Promise<any>;
//   handleEvent(event: string, arg: any): ((context: BaseEvent<any>) => void);
// }


// export class WorkerProtocol {
//   #id: string;
//   #lastRequest: string;
//   #pendingReplies: Dict<MessageReply>;
//   #pendingEmitters: Map<string, EventEmitter>;
//   #pendingEvents: Map<string, IDisposable>;
//   #handler: MessageHandler;
// }
