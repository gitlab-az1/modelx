import { Pair } from './pair';
import { ReadonlyMap } from './map';


export interface Frequency<T> {
  readonly objectsCount: number;
  readonly pairs: readonly Pair<T, number>[];
  readonly map: ReadonlyMap<T, Pair<T, number>>;
}

export function termFrequency<T>(arr: T[]): Frequency<T> {
  const frequencies = new Map<T, Pair<T, number>>();

  for(let i = 0; i < arr.length; i++) {
    const freq = frequencies.get(arr[i])?.second || 0;
    frequencies.set(arr[i], new Pair(arr[i], freq + 1));
  }

  return Object.freeze({
    objectsCount: frequencies.size,
    map: new ReadonlyMap(frequencies),
    pairs: Object.freeze(Array.from(frequencies.values())),
  });
}


export function round(value: number, base = 1): number {
  if(Math.abs(base) >= 1) return Math.round(value / base) * base;
  
  // Sometimes when a number is multiplied by a small number, precision is lost,
  // for example 1234 * 0.0001 === 0.12340000000000001, and it's more precise divide: 1234 / (1 / 0.0001) === 0.1234.
  const counterBase = 1 / base;
  return Math.round(value * counterBase) / counterBase;
}


export function isBase64(str: unknown): str is string {
  if(!str || typeof str !== 'string') return false;

  try {
    // eslint-disable-next-line no-useless-escape
    const base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
    return (str.length % 4 === 0 && base64Regex.test(str)) || btoa(atob(str)) === str;
  } catch {
    return false;
  }
}

export function isBase64Url(str: unknown): str is string {
  if(!str || typeof str !== 'string') return false;

  try {
    // Base64URL regex: no '+' or '/' and may not have '=' padding
    const base64UrlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
    // const base64UrlRegex = /^(?:[A-Za-z0-9_-]{4})*?(?:[A-Za-z0-9_-]{2}==|[A-Za-z0-9_-]{3}=|[A-Za-z0-9_-]{4})?$/;
    
    return (
      base64UrlRegex.test(str) || 
      btoa(atob(str.replace(/-/g, '+').replace(/_/g, '/'))) === str.replace(/-/g, '+').replace(/_/g, '/')
    );
  } catch {
    return false;
  }
}

export function isTimestamp(str: unknown): str is string {
  if(typeof str !== 'string') return false;

  // Regex for Unix timestamp (10 or 13 digits)
  const unixTimestampRegex = /^\d{10}(\d{3})?$/;

  // Regex for ISO 8601 date-time
  const iso8601Regex = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))$/;

  if(unixTimestampRegex.test(str)) {
    const date = new Date(Number(str));
    return !isNaN(date.getTime());
  }

  if(iso8601Regex.test(str)) {
    const date = new Date(str);
    return !isNaN(date.getTime());
  }

  return false;
}

export function isURL(str: unknown): str is string {
  if(typeof str !== 'string') return false;

  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

export function isDate(str: unknown): str is string {
  if(typeof str !== 'string') return false;

  const date = new Date(str);
  return !isNaN(date.getTime());
}

export function isIPv4(str: unknown): str is string {
  if(typeof str !== 'string') return false;

  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
  const ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;

  return ipv4Regex.test(str) || ipv4CidrRegex.test(str);
}

export function isIPv6(str: unknown): str is string {
  if(typeof str !== 'string') return false;

  const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
  const ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;

  return ipv6Regex.test(str) || ipv6CidrRegex.test(str);
}


export function isEmail(str: unknown): str is string {
  // eslint-disable-next-line no-useless-escape
  return typeof str === 'string' && /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i.test(str);
}
