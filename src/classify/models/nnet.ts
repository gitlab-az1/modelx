import { random } from '../../math/native';
import { isThenable } from '../../@internals/util';
import { Exception } from '../../@internals/errors';
import { activate, type ActivationMethod } from '../../math/activation';


export function feedForward(target: Level | Network, input: number[], activation?: ActivationMethod | ((x: number) => number)): number[] {
  let result: number[];

  if(target instanceof Network) {
    result = feedForward(target.levels[0], input);

    for(let i = 0; i < target.levels.length; i++) {
      result = feedForward(target.levels[i], result);
    }
  } else if(isLevel(target)) {
    for(let i = 0; i < target.inputs.length; i++) {
      target.inputs[i] = input[i];
    }
  
    for(let i = 0; i < target.outputs.length; i++) {
      let sum = 0;
  
      for(let j = 0; j < target.inputs.length; j++) {
        sum += target.inputs[j] * target.weights[j][i];
      }
  
      target.outputs[i] = _activateResult(sum + target.biases[i], activation);
    }
  
    result = target.outputs;
  } else {
    throw new Exception(`Cannot calculate feed forward for 'typeof ${typeof target}'`, 'ERR_INVALID_ARGUMENT');
  }

  return result;
}

export function isLevel(arg: unknown): arg is Level {
  return (
    (!!arg && typeof arg === 'object' && !Array.isArray(arg)) &&
      (
        (arg instanceof Level) ||
        (
          (!!(<Level>arg).inputs && Array.isArray((<Level>arg).inputs)) &&
          (!!(<Level>arg).outputs && Array.isArray((<Level>arg).outputs)) &&
          (!!(<Level>arg).biases && Array.isArray((<Level>arg).biases)) &&
          (!!(<Level>arg).weights && Array.isArray((<Level>arg).weights) && (<Level>arg).weights.every(Array.isArray))
        )
      )
  );
}

function _activateResult(x: number, activation?: ActivationMethod | ((x: number) => number)): number {
  if(!activation) return x > 0 ? 1 : 0;
  if(typeof activation === 'string') return activate(activation, x);

  const r = activation(x);

  if(isThenable(r)) {
    throw new Exception('The result of activation function must be synchronous', 'ERR_UNEXPECTED_PROMISE');
  }

  return r;
}

export class Level {
  static #randomize(instance: Level): void {
    for(let i = 0; i < instance.inputs.length; i++) {
      for(let j = 0; j < instance.outputs.length; j++) {
        instance.weights[i][j] = random() * 2 - 1;
      }
    }

    for(let i = 0; i < instance.biases.length; i++) {
      instance.biases[i] = random() * 2 - 1;
    }
  }

  public readonly inputs: number[];
  public readonly outputs: number[];
  public readonly biases: number[];
  public readonly weights: number[][];

  public constructor(_in: number, _out: number) {
    this.inputs = new Array(_in);
    this.outputs = new Array(_out);
    this.biases = new Array(_out);

    this.weights = [];

    for(let i = 0; i < _in; i++) {
      this.weights[i] = new Array(_out);
    }

    Level.#randomize(this);
  }
}


export class Network {
  public readonly levels: Level[];

  public constructor(_neuronsCounts: number[]) {
    this.levels = [];

    for(let i = 0; i < _neuronsCounts.length - 1; i++) {
      this.levels.push(new Level(_neuronsCounts[i], _neuronsCounts[i + 1]));
    }
  }
}
