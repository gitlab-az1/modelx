const hasPerformanceNow = (
  (globalThis.performance && typeof globalThis.performance.now === 'function') ||
  (typeof performance !== 'undefined' && typeof performance.now === 'function')
);


export function timestamp(highResolution?: boolean): number {
  return hasPerformanceNow && highResolution !== false ? Date.now() : (globalThis.performance?.now || performance.now)();
}


type Unit = 'ms' | 's' | 'm' | 'h';

export class StopWatch {
  readonly #now: () => number;

  #startTime: number;
  #stopTime: number;

  public constructor(highResolution?: boolean) {
    this.#now = () => timestamp(highResolution);

    this.#startTime = this.#now();
    this.#stopTime = -1;
  }

  public stop(): void {
    this.#stopTime = this.#now();
  }

  public reset(): void {
    this.#startTime = this.#now();
    this.#stopTime = -1;
  }

  /**
   * Returns the elapsed time since the stopwatch was started.
   * 
   * @param [unit='ms'] The unit of time to return the elapsed time in.
   * @returns {number} The elapsed time in the specified unit.
   */
  public elapsed(unit: Unit = 'ms'): number {
    let t: number = this.#stopTime !== -1 ? this.#stopTime - this.#startTime : this.#now() - this.#startTime;

    switch(unit) {
      case 's':
        t = t / 1000;
        break;
      case 'm':
        t = t / 60000;
        break;
      case 'h':
        t = t / 3600000;
        break;
    }

    // return unit !== 'ms' ? Number(t.toFixed(2)) : t;
    return t;
  }
}
