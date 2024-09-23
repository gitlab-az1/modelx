import { generateRandomNumber } from './crypto';


const alphabet: string[] = [
  ...('abcdefghijklmnopqrstuvwxyz'.split('')),
  ...('abcdefghijklmnopqrstuvwxyz'.split('').map(item => item.toUpperCase())),
  ...('0123456789'.split('')),
];


/**
 * Generates a random string of a given length using
 * a secure random number generator
 * 
 * @param {number} length The length of the string to generate 
 * @returns {Promise<string>} A promise that resolves to a random string
 */
export async function shortId(length: number = 10): Promise<string> {
  let result = '';
  const len = typeof length === 'number' && length > 0 ? length : 10;
  
  for(let i = 0; i < len; i++) {
    let iter = 0;

    // generates a secure random between 0 and 1
    let random = await generateRandomNumber();
    let current = alphabet[Math.floor(random * alphabet.length)];

    while(!current) {
      random = await generateRandomNumber();
      current = alphabet[Math.floor(random * alphabet.length)];
      
      if(++iter > 20) {
        throw new Error('Failed to generate a random number');
      }
    }

    result += current;
  }

  return result;
}


/**
 * Generates a random string of a given length using
 * the `Math.random()` function.
 * 
 * WARNING: This function is not than secure than the `shortId` function,
 * be sure to use it only when security is not a concern or prefer to use
 * the promise-based function.
 * 
 * @param {number} length The length of the string to generate 
 * @returns {string} A random string
 */
export function shortIdSync(length: number = 10): string {
  let result = '';
  const len = typeof length === 'number' && length > 0 ? length : 10;
  
  for(let i = 0; i < len; i++) {
    let iter = 0;

    let random = Math.random();
    let current = alphabet[Math.floor(random * alphabet.length)];

    while(!current) {
      random = Math.random();
      current = alphabet[Math.floor(random * alphabet.length)];
      
      if(++iter > 20) {
        throw new Error('Failed to generate a random number');
      }
    }

    result += current;
  }

  return result;
}
