import { EventLoop } from '@ts-overflow/async/event-loop';

import { ensureDirSync } from '../../fs';
import { setLastError } from '../../environment';
import { Exception } from '../../@internals/errors';
import { jsonSafeStringify } from '../../@internals/json';
import { colorizeLevel, formatStringTemplate, Message, MessageStream, type MessageStreamOptions, removeNonASCIICharacters, stringifyLevel } from './core';

import {
  ASCI_GREEN,
  ASCI_MAGENTA,
  ASCI_RESET,
} from '../../@internals/util';


let nfs: any = void 0;
let np: any = void 0;


function __$__nfs(): typeof import('fs') {
  if(!nfs) {
    nfs = require('fs');
  }

  return nfs;
}

function __$__npath(): typeof import('path') {
  if(!np) {
    np = require('path');
  }

  return np;
}


export type FileStreamOptions = {
  path: string | Buffer;
  maxFileSize?: number;
}

export class File extends MessageStream {
  private _filename: string;
  private readonly _dirname: string;
  private readonly _nfs: typeof import('fs');
  private readonly _npath: typeof import('path');

  private _writedBytes: number = 0;
  private _pendingBytes: number = 0;
  private readonly _maxSize: number = -1;

  public constructor(options: FileStreamOptions & MessageStreamOptions) {
    super(options);

    if(!(this._nfs = __$__nfs())) {
      throw setLastError(new Exception('Failed to access filesystem handler in current environment', 'ERR_UNSUPPORTED_OPERATION'));
    }

    this._npath = __$__npath();
    this._dirname = this._npath.dirname(options.path.toString());
    this._filename = this._npath.basename(options.path.toString());

    ensureDirSync(this._dirname);
    
    if(!this._nfs.existsSync(options.path.toString())) {
      this._writedBytes = 0;
    } else {
      this._writedBytes = this._nfs.statSync(options.path.toString()).size;
    }
  }

  public transform(msg: Message): string {
    let textMessage = '';

    if(!this._omitDate) {
      textMessage = `${ASCI_GREEN}${new Date().toISOString()}${ASCI_RESET}`;
    }

    if(this.getNamespace()) {
      textMessage += ` ${ASCI_MAGENTA}${this.getNamespace()}${ASCI_RESET}`;
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

    return (removeNonASCIICharacters(`${textMessage.trim()} ${formatStringTemplate(msg.text, msg.arguments)}`) + this.eol);
  }

  public _forward(msg: Message): void {
    if(msg.level > this._level) return;

    const message = removeNonASCIICharacters(this.transform(msg));
    const bytes = Buffer.byteLength(message);

    this._pendingBytes += bytes;

    if(this._maxSize !== -1 && this._writedBytes + bytes > this._maxSize) {
      this._nfs.renameSync(
        this._npath.join(this._dirname, this._filename),
        this._npath.join(this._dirname, `${this._filename.replace(/\.\d+\.log/, '')}.${Date.now()}.log`));

      this._filename = `${this._filename.replace(/\.\d+\.log/, '')}.${Date.now()}.log`;
    }

    EventLoop.immediate(() => {
      this._nfs.appendFileSync(this._npath.join(this._dirname, this._filename), message);

      this._writedBytes += bytes;
      this._pendingBytes -= bytes;
    });
  }
}

export default File;
