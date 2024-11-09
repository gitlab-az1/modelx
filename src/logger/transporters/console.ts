import { jsonSafeStringify } from '../../@internals/json';
import { colorizeLevel, formatStringTemplate, LogLevel, Message, MessageStream, stringifyLevel } from './core';

import {
  ASCI_GREEN,
  ASCI_RESET,
} from '../../@internals/util';


export class Console extends MessageStream {
  public transform(msg: Message): string {
    let textMessage = '';

    if(!this._omitDate) {
      textMessage = `${ASCI_GREEN}${new Date().toISOString()}${ASCI_RESET}`;
    }

    textMessage += ` ${colorizeLevel(msg.level)}[${stringifyLevel(msg.level)}]${ASCI_RESET} `;

    if(!!msg.arguments && Array.isArray(msg.arguments)) {
      for(let i = 0; i < msg.arguments.length; i++) {
        if((msg.arguments[i] as any) instanceof Error) {
          const errCandidate = (msg.arguments[i] as unknown as Error);
          msg.arguments[i] = `|${errCandidate.name}| ${errCandidate.message} at ${errCandidate.stack || 'Unknown stack trace'}`;
        } else if(typeof msg.arguments[i] === 'object') {
          msg.arguments[i] = jsonSafeStringify(msg.arguments[i], null, 2) || '';
        }
      }
    }

    if(typeof msg.text !== 'string') {
      msg.text = typeof msg.text === 'number' ? (msg.text as any).toString() : jsonSafeStringify(msg.text, null, 2) || '{}';
    }

    return `${textMessage.trim()} ${formatStringTemplate(msg.text, msg.arguments)}${this.eol}`;
  }

  public _forward(msg: Message): void {
    if(msg.level > this._level) return;

    if(msg.level < LogLevel.Warn) {
      if(typeof process === 'undefined' || this._forceConsole) {
        console.log(this.transform(msg));
      } else {
        process.stdout.write(this.transform(msg));
      }
    } else if(msg.level < LogLevel.Error) {
      if(typeof process === 'undefined' || this._forceConsole) {
        console.warn(this.transform(msg));
      } else {
        process.stdout.write(this.transform(msg));
      }
    } else {
      if(typeof process === 'undefined' || this._forceConsole) {
        console.error(this.transform(msg));
      } else {
        process.stderr.write(this.transform(msg));
      }
    }
  }
}

export default Console;
