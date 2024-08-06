// /**
//  * @copyright https://github.io/compute-io/compute-gcd
//  * @see https://www.npmjs.com/package/compute-gcd
// */

// import { pow } from './native';


// const MAXINT = pow(2, 31) - 1;


// function _gcd(a: number, b: number) {
//   let k = 1, t;

//   // Simple cases:
//   if (a === 0) return b;
//   if (b === 0) return a;

//   // Reduce `a` and/or `b` to odd numbers and keep track of the greatest power of 2 dividing both `a` and `b`...
//   while(a % 2 === 0 && b % 2 === 0 ) {
//     a = a / 2; // right shift
//     b = b / 2; // right shift
//     k = k * 2; // left shift
//   }

//   // Reduce `a` to an odd number...
//   while(a % 2 === 0) {
//     a = a / 2; // right shift
//   }

//   // Henceforth, `a` is always odd...
//   while (b) {
//     // Remove all factors of 2 in `b`, as they are not common...
//     while (b % 2 === 0) {
//       b = b / 2; // right shift
//     }

//     // `a` and `b` are both odd. Swap values such that `b` is the larger of the two values, and then set `b` to the difference (which is even)...
//     if(a > b) {
//       t = b;
//       b = a;
//       a = t;
//     }

//     b = b - a; // b=0 iff b=a
//   }

//   // Restore common factors of 2...
//   return k * a;
// }

// function _bitwise(a: number, b: number): number {
//   let k = 0, t;

//   // Simple cases:
//   if(a === 0) return b;
//   if(b === 0) return a;
	
//   // Reduce `a` and/or `b` to odd numbers and keep track of the greatest power of 2 dividing both `a` and `b`...
//   while((a & 1) === 0 && (b & 1) === 0) {
//     a >>>= 1; // right shift
//     b >>>= 1; // right shift
//     k++;
//   }

//   // Reduce `a` to an odd number...
//   while((a & 1) === 0) {
//     a >>>= 1; // right shift
//   }

//   // Henceforth, `a` is always odd...
//   while(b) {
//     // Remove all factors of 2 in `b`, as they are not common...
//     while((b & 1) === 0) {
//       b >>>= 1; // right shift
//     }

//     // `a` and `b` are both odd. Swap values such that `b` is the larger of the two values, and then set `b` to the difference (which is even)...
//     if(a > b) {
//       t = b;
//       b = a;
//       a = t;
//     }

//     b = b - a; // b=0 iff b=a
//   }

//   // Restore common factors of 2...
//   return a << k;
// }
