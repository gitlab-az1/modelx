export class MinHeap<T> {
  #heap: T[];
  #compare: (a: T, b: T) => number;

  public constructor(compare: (a: T, b: T) => number) {
    this.#heap = [];
    this.#compare = compare;
  }

  public get size(): number {
    return this.#heap.length;
  }

  public insert(value: T): void {
    this.#heap.push(value);
    this.#bubbleUp(this.#heap.length - 1);
  }

  public extractMin(): T | undefined {
    if(this.#heap.length === 0) return undefined;

    const min = this.#heap[0];
    const last = this.#heap.pop()!;

    if(this.#heap.length > 0) {
      this.#heap[0] = last;
      this.#bubbleDown(0);
    }

    return min;
  }

  #bubbleUp(index: number): void {
    while(index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);

      if(this.#compare(this.#heap[index], this.#heap[parentIndex]) >= 0) break;

      [this.#heap[index], this.#heap[parentIndex]] = [this.#heap[parentIndex], this.#heap[index]];
      index = parentIndex;
    }
  }

  #bubbleDown(index: number): void {
    const length = this.size;
    const element = this.#heap[index];

    // eslint-disable-next-line no-constant-condition
    while(true) {
      const leftChildIndex = 2 * index + 1;
      const rightChildIndex = 2 * index + 2;
      let swapIndex = -1;

      if(leftChildIndex < length && this.#compare(this.#heap[leftChildIndex], element) < 0) {
        swapIndex = leftChildIndex;
      }

      if(
        rightChildIndex < length &&
        this.#compare(this.#heap[rightChildIndex], swapIndex === -1 ? element : this.#heap[leftChildIndex]) < 0
      ) {
        swapIndex = rightChildIndex;
      }

      if(swapIndex === -1) break;

      this.#heap[index] = this.#heap[swapIndex];
      this.#heap[swapIndex] = element;
      index = swapIndex;
    }
  }
}
