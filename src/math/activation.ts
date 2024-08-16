import * as nativeMath from './native';
import { Exception } from '../@internals/errors';


export type ActivationMethod =
  | 'sigmoid'
  | 'relu'
  | 'gelu'
  | 'prelu'
  | 'elu'
  | 'swish'
  | 'selu'
  | 'softplus'
  | 'mish'
  | 'rrelu'
  | 'hardswish'
  | 'sigmoid'
  | 'softsign'
  | 'tanh'
  | 'hardtanh'
  | 'hardsigmoid'
  | 'tanhshrink'
  | 'softshrink'
  | 'hardshrink';


export function isActivationFunction(arg: unknown): arg is ActivationMethod {
  if(!arg || typeof arg !== 'string') return false;
  return ['sigmoid', 'relu'].includes(arg);
}


/**
 * Calculates the ReLU (Rectified Linear Unit)
 * 
 * @param {number} x 
 * @returns {number}
 */
export function relu(x: number): number {
  return nativeMath.max(0, x);
}

/**
 * Calculates the GELU (Gaussian Error Linear Unit)
 * 
 * @param {number} x 
 * @returns {number}
 */
export function gelu(x: number): number {
  return 0.5 * x * (1 + nativeMath.tanh(nativeMath.sqrt(2 / nativeMath.PI) * (x + 0.044715 * nativeMath.pow(x, 3))));
}

/**
 * Calculates the PReLU (Parametric ReLU)
 * 
 * @param {number} x 
 * @param {number} alpha 
 * @returns {number}
 */
export function prelu(x: number, alpha: number = 0.01): number {
  return x >= 0 ? x : alpha * x;
}

/**
 * Calculates the ELU (Exponential Linear Unit)
 * 
 * @param {number} x 
 * @param {number} alpha 
 * @returns {number}
 */
export function elu(x: number, alpha: number = 1.0): number {
  return x >= 0 ? x : alpha * (nativeMath.exp(x) - 1);
}

/**
 * Calculates the Swish
 * 
 * @param {number} x 
 * @returns {number}
 */
export function swish(x: number): number {
  return x / (1 + nativeMath.exp(-x));
}

/**
 * Calculates the SELU (Scaled Exponential Linear Unit)
 * 
 * @param {number} x 
 * @returns {number}
 */
export function selu(x: number): number {
  const alpha = 1.6732632423543772; // Improved precision constant
  const scale = 1.0507009873554805; // Improved precision constant

  return x >= 0 ? scale * x : scale * alpha * (nativeMath.exp(x) - 1);
}

/**
 * Calculates the SoftPlus
 * 
 * @param {number} x 
 * @returns {number}
 */
export function softplus(x: number): number {
  return nativeMath.log(1 + nativeMath.exp(x));
}

/**
 * Calculates the Mish
 * 
 * @param {number} x 
 * @returns {number}
 */
export function mish(x: number): number {
  return x * nativeMath.tanh(softplus(x));
}

/**
 * Calculates the RReLU (Randomized Leaky ReLU)
 * 
 * @param {number} x 
 * @param {number} lower 
 * @param {number} upper 
 * @returns {number}
 */
export function rrelu(x: number, lower: number = 0.01, upper: number = 0.03): number {
  const alpha = nativeMath.random() * (upper - lower) + lower;
  return x >= 0 ? x : alpha * x;
}

/**
 * Calculates the HardSwish
 * 
 * @param {number} x 
 * @returns {number}
 */
export function hardswish(x: number): number {
  return x * nativeMath.max(0, nativeMath.min(1, (x + 3) / 6));
}

/**
 * Calculates the Sigmoid
 * 
 * @param {number} x 
 * @returns {number}
 */
export function sigmoid(x: number): number {
  return 1 / (1 + nativeMath.exp(-x));
}

/**
 * Calculates the SoftSign
 * 
 * @param {number} x 
 * @returns {number}
 */
export function softsign(x: number): number {
  return x / (1 + nativeMath.abs(x));
}

/**
 * Calculates the Tanh
 * 
 * @param {number} x 
 * @returns {number}
 */
export function tanh(x: number): number {
  return nativeMath.tanh(x);
}

/**
 * Calculates the HardTanh
 * 
 * @param {number} x 
 * @returns {number}
 */
export function hardtanh(x: number): number {
  return nativeMath.max(-1, nativeMath.min(1, x));
}

/**
 * Calculates the HardSigmoid
 * 
 * @param {number} x 
 * @returns {number}
 */
export function hardsigmoid(x: number): number {
  return nativeMath.max(0, nativeMath.min(1, 0.2 * x + 0.5));
}

/**
 * Calculates the TanhShrink
 * 
 * @param {number} x 
 * @returns {number}
 */
export function tanhshrink(x: number): number {
  return x - nativeMath.tanh(x);
}

/**
 * Calculates the SoftShrink
 * 
 * @param {number} x 
 * @param {number} lambda 
 * @returns {number}
 */
export function softshrink(x: number, lambda: number = 0.5): number {
  return x > lambda ? x - lambda : x < -lambda ? x + lambda : 0;
}

/**
 * Calculates the HardShrink
 * 
 * @param {number} x 
 * @param {number} lambda 
 * @returns {number}
 */
export function hardshrink(x: number, lambda: number = 0.5): number {
  return nativeMath.abs(x) > lambda ? x : 0;
}


export function activate(method: ActivationMethod, x: number): number {
  switch(method) {
    case 'elu':
      return elu(x);
    case 'gelu':
      return gelu(x);
    case 'hardshrink':
      return hardshrink(x);
    case 'hardsigmoid':
      return hardsigmoid(x);
    case 'hardswish':
      return hardswish(x);
    case 'hardtanh':
      return hardtanh(x);
    case 'mish':
      return mish(x);
    case 'prelu':
      return prelu(x);
    case 'relu':
      return relu(x);
    case 'rrelu':
      return rrelu(x);
    case 'selu':
      return selu(x);
    case 'sigmoid':
      return sigmoid(x);
    case 'softplus':
      return softplus(x);
    case 'softshrink':
      return softshrink(x);
    case 'softsign':
      return softsign(x);
    case 'swish':
      return swish(x);
    case 'tanh':
      return tanh(x);
    case 'tanhshrink':
      return tanhshrink(x);
    default:
      throw new Exception('Cannot determinate what activation function you want to use', 'ERR_INVALID_ARGUMENT');
  }
}
