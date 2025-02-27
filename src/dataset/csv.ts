import fs from 'node:fs';

import { readBinary } from '../fs';
import { setLastError } from '../environment';
import { buffer } from '../@internals/buffer';
import { Exception } from '../@internals/errors';
import type { BinaryHolder, MaybeArray, Interval } from '../@internals/types';


export type CSVParserOptions = {
  commentsWith?: MaybeArray<string>;
  ignoreHeader?: boolean;
  commaAlias?: string;
};

export function csv<T extends object>(
  input: BinaryHolder | string,
  options?: CSVParserOptions,
): T[] {
  const result = [] as T[];
  const content = (typeof input === 'string' ? input : buffer(input).toString()).trim();
  const rows = content.split(content.includes('\r\n') ? '\r\n' : '\n');

  if (rows.length === 0 || (rows.length === 1 && options?.ignoreHeader !== true)) return [];

  const header = options?.ignoreHeader === true ? null : [] as string[];

  const parseRow = (line: string): string[] => {
    const tokens = [];
    let currentToken = '';
    let insideQuote = false;
    let quoteChar = '';

    for(let i = 0; i < line.length; i++) {
      const char = line[i];

      if(insideQuote) {
        if(char === quoteChar) {
          // Closing quote
          if(line[i + 1] === quoteChar) {
            // Escaped quote ("" or '')
            currentToken += char;
            i++; // Skip the next character
          } else {
            insideQuote = false;
          }
        } else {
          currentToken += char;
        }
      } else {
        if(char === '"' || char === '\'') {
          // Starting quote
          insideQuote = true;
          quoteChar = char;
        } else if(char === ',') {
          // Column delimiter
          tokens.push(currentToken.trim());
          currentToken = '';
        } else {
          currentToken += char;
        }
      }
    }

    // Push the last token
    tokens.push(currentToken.trim());

    return tokens.map(token =>
      token.replace(new RegExp(`\\${options?.commaAlias || '%c'}`, 'g'), ','),
    );
  };

  for(let i = 0; i < rows.length; i++) {
    const row = {} as Record<string | number, string | number | Interval | boolean | null>;
    const columns = parseRow(rows[i]);

    for(let j = 0; j < columns.length; j++) {
      if(i === 0 && header != null) {
        header.push(columns[j]);
      } else {
        const index = header != null ? header[j] : j;
        row[index] = _eval(columns[j]);
      }
    }

    if(i !== 0 || header === null) {
      result.push(row as T);
    }
  }

  return result;
}



export type CSVReadOptions = {
  mask?: Uint8Array;
};

export async function read_csv<T>(filepath: string | URL, options?: CSVParserOptions & CSVReadOptions): Promise<T[]> {
  if(filepath instanceof URL) {
    filepath = filepath.toString();
  }

  if(
    filepath.startsWith('http://') ||
    filepath.startsWith('https://') ||
    filepath.startsWith('ftp://') ||
    filepath.startsWith('ftps://') ||
    filepath.startsWith('sftp://')
  ) {
    throw setLastError(new Exception('Read csv files over network is not supported yet.', 'ERR_UNSUPPORTED_OPERATION'));
  }

  if(!fs.existsSync(filepath)) {
    throw setLastError(new Exception(`Could not found file '${filepath}'`, 'ERR_FILE_NOT_FOUND'));
  }

  const buffer = await (options?.mask ? readBinary(filepath, options.mask) : fs.promises.readFile(filepath));

  return csv(buffer, {
    commentsWith: options?.commentsWith,
    ignoreHeader: options?.ignoreHeader,
  }) as any;
}

function _eval(arg: any): string | number | Interval | boolean | null {
  if(/^{([-+]?\d*\.?\d+|0x[0-9a-fA-F]+|0o[0-7]+)\.\.([-+]?\d*\.?\d+|0x[0-9a-fA-F]+|0o[0-7]+)}$/.test(arg)) return _parseInterval(arg);

  if(/^[-+]?\d+(\.\d+)?$/.test(arg)) return Number(arg);
  if(['true', 'false'].includes(arg)) return arg === 'true';
  if(arg === 'NULL') return null;

  return String(arg);
}

function _parseInterval(input: string): readonly [number, number] | null {
  const match = input.match(/^{([-+]?\d*\.?\d+|0x[0-9a-fA-F]+|0o[0-7]+)\.\.([-+]?\d*\.?\d+|0x[0-9a-fA-F]+|0o[0-7]+)}$/);
  if(!match) return null;

  const parseNumber = (str: string): number => {
    if(str.startsWith('0x')) return parseInt(str, 16);
    if(str.startsWith('0o')) return parseInt(str, 8);
    if(str.includes('.')) return parseFloat(str);
    return parseInt(str, 10);
  };

  return Object.freeze([parseNumber(match[1]), parseNumber(match[2])]);
}
