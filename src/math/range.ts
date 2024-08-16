export class Range {
  readonly #min: number;
  readonly #max: number;
  #step: number;
  
  public constructor(
    _min: number,
    _max: number,
    _stepCount?: number // eslint-disable-line comma-dangle
  ) {
    this.#min = _min;
    this.#max = _max;
    this.#step = typeof _stepCount === 'number' ? _stepCount : (_max - _min) / 10;
  }

  public get step(): number {
    return this.#step;
  }

  public get min(): number {
    return this.#min;
  }

  public get max(): number {
    return this.#max;
  }

  public setStep(step: number): this {
    this.#step = step;
    return this;
  }
}

export default Range;
