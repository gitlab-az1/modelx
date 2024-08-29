import { getRandomValues } from './crypto/random';


export function shortId(): string {
  const ts = Date.now().toString(16).padStart(12, '0');
  const rand = Array.from(getRandomValues(new Uint8Array(10)))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  return `${ts.substring(0, 12)}${(parseInt(rand.substring(3, 5), 16) & 0x3f | 0x80).toString(16).padStart(2, '0') + rand.substring(5, 7)}`;
}
