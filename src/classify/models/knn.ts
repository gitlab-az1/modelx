import { LearningModel } from '../core';


export interface KNNSample {
  rate: number;
}


export class KNearestNeighbors implements LearningModel {
  #neighbors: number;

  public constructor(
    _s: KNNSample[],
    _neighborsCount: number = 8 // eslint-disable-line comma-dangle
  ) {
    this.#neighbors = _neighborsCount;
  }

  public get K(): number {
    return this.#neighbors;
  }
}

export default KNearestNeighbors;
