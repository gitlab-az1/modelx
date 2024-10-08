import { Exception } from './@internals/errors';


const $items = Symbol('QUEUE::INTERNAL_DESCRIPTOR.Items');
const $msize = Symbol('QUEUE::INTERNAL_DESCRIPTOR.MaxSize');
const $lenof = Symbol('QUEUE::INTERNAL_DESCRIPTOR.LengthOf');

export class WeakQueue<T> {
  private [$lenof]: number;
  private readonly [$items]: T[];
  private readonly [$msize]: number | null;

  public constructor(length: number, iterable?: Iterable<T>);
  public constructor(iterable?: Iterable<T>);
  public constructor(_iterableOrLength?: Iterable<T> | number, _iterable?: Iterable<T>) {
    this[$lenof] = 0;
    this[$items] = [];
    this[$msize] = typeof _iterableOrLength === 'number' ? _iterableOrLength : null;

    const iter = typeof _iterableOrLength === 'number' ? 
      _iterable : _iterableOrLength;

    if(!iter) return;
    Array.prototype.forEach.call(Array.isArray(iter) ? iter : Array.from(iter),
      this.add.bind(this));
  }

  public get isEmpty(): boolean {
    return this[$lenof] === 0;
  }

  public get size(): number {
    return this[$lenof];
  }

  public get maxSize(): number | null {
    return this[$msize];
  }

  /**
   * Add an item to the queue.
   * @param {T} item The item to add to the queue.
   * @returns {void}
   * @throws {Exception} If the queue has reached its maximum size.
   */
  public add(item: T): void {
    if(this[$msize] != null && this[$lenof] >= this[$msize]) {
      throw new Exception('Cannot add more items to a queue that has reached its maximum size.', 'ERR_OUT_OF_BOUNDS');
    }

    this[$items].push(item);
    this[$lenof]++;
  }

  /**
   * Add multiple items to the queue
   * @param {...T} items The items to add to the queue.
   * @returns {void}
   * @throws {Exception} If the queue has reached its maximum size.
   */
  public addAll(...items: T[]): void {
    if(this[$msize] != null && this[$lenof] + items.length > this[$msize]) {
      throw new Exception('Cannot add more items to a queue that has reached its maximum size.', 'ERR_OUT_OF_BOUNDS');
    }

    this[$items].push(...items);
    this[$lenof] += items.length;
  }

  /**
   * Offer an item to the queue.
   * @param {T} item The item to offer to the queue.
   * @returns {boolean} `true` if the item was successfully offered to the queue, `false` otherwise.
   */
  public offer(item: T): boolean {
    if(this[$msize] != null && this[$lenof] >= this[$msize]) return false;

    this[$items].push(item);
    this[$lenof]++;

    return true;
  }

  /**
   * Remove an item from the queue.
   * @returns {T} The item that was removed from the queue.
   * @throws {Exception} If the queue is empty.
   */
  public remove(): T {
    if(this[$lenof] === 0 || this[$items].length === 0) {
      throw new Exception('Cannot remove an item from an empty queue.', 'ERR_OUT_OF_BOUNDS');
    }

    this[$lenof]--;
    return this[$items].shift() as T;
  }

  /**
   * Poll an item from the queue.
   * @returns {T | undefined} The item that was polled from the queue, or `undefined` if the queue is empty.
   */
  public poll(): T | undefined {
    if(this[$lenof] === 0 || this[$items].length === 0) return undefined;

    this[$lenof]--;
    return this[$items].shift() as T;
  }

  /**
   * Get the front item of the queue.
   * @returns {T} The front item of the queue.
   * @throws {Exception} If the queue is empty.
   */
  public element(): T {
    if(this[$lenof] === 0 || this[$items].length === 0) {
      throw new Exception('Cannot get the element from an empty queue.', 'ERR_OUT_OF_BOUNDS');
    }

    return this[$items][0];
  }

  /**
   * Peek at the front item of the queue.
   * @returns {T | undefined} The front item of the queue, or `undefined` if the queue is empty.
   */
  public peek(): T | undefined {
    if(this[$lenof] === 0 || this[$items].length === 0) return undefined;
    return this[$items][0];
  }

  /**
   * Check if the queue contains an item.
   * @param {T} item The item to check for in the queue.
   * @returns {boolean} `true` if the queue contains the item, `false` otherwise.
   * @throws {Exception} If the queue is empty.
   */
  public contains(item: T): boolean {
    return this[$items].includes(item);
  }

  /**
   * Check if the queue contains all the items.
   * @param {...T} items The items to check for in the queue.
   * @returns {boolean} `true` if the queue contains all the items, `false` otherwise.
   * @throws {Exception} If the queue is empty.
   */
  public containsAll(...items: T[]): boolean {
    return items.every(item => this[$items].includes(item));
  }

  /**
   * Search for an item in the queue.
   * @param {T} item The item to search for in the queue.
   * @returns {number} The index of the item in the queue, or `0` if the item is not found.
   */
  public search(item: T): number {
    return this[$items].indexOf(item) + 1;
  }

  /**
   * Convert the queue to an array.
   * @returns {T[]} An array containing the items in the queue.
   */
  public toArray(): T[] {
    return [ ...this[$items] ];
  }

  /**
   * Clear the queue.
   * @returns {void}
   */
  public clear(): void {
    this[$items].length = 0;
    this[$lenof] = 0;
  }

  public *[Symbol.iterator](): IterableIterator<T> {
    for(const item of this[$items]) {
      yield item;
    }
  }
}


type PriorityQueueItem<T> = {
  priority: number;
  item: T;
};


export class PriorityQueue<T> {
  private [$lenof]: number;
  private readonly [$msize]: number | null;
  private readonly [$items]: PriorityQueueItem<T>[];

  public constructor(_capacity?: number) {
    this[$lenof] = 0;
    this[$items] = [];
    this[$msize] = _capacity && _capacity > 0 ? _capacity : null;
  }

  public get isEmpty(): boolean {
    return this[$lenof] === 0;
  }

  public get size(): number {
    return this[$lenof];
  }

  public get maxSize(): number | null {
    return this[$msize];
  }

  /**
   * Add an item to the queue with a priority.
   * @param {T} item The item to add to the queue.
   * @param {number} priority The priority of the item.
   * @returns {void}
   * @throws {Exception} If the queue has reached its maximum size.
   */
  public add(item: T, priority: number): void {
    if(this[$msize] != null && this[$lenof] >= this[$msize]) {
      throw new Exception('Cannot add more items to a queue that has reached its maximum size.', 'ERR_OUT_OF_BOUNDS');
    }

    this[$items].push({ priority, item });
    this[$lenof]++;

    this[$items].sort((a, b) => {
      if(!a || !b) return 0;
      return a.priority - b.priority;
    });
  }

  /**
   * Offer an item to the queue with a priority.
   * @param {T} item The item to offer to the queue.
   * @param {number} priority The priority of the item.
   * @returns {boolean} `true` if the item was successfully offered to the queue, `false` otherwise.
   */
  public offer(item: T, priority: number): boolean {
    if(this[$msize] != null && this[$lenof] >= this[$msize]) return false;

    this[$items].push({ priority, item });
    this[$lenof]++;

    this[$items].sort((a, b) => {
      if(!a || !b) return 0;
      return a.priority - b.priority;
    });

    return true;
  }

  /**
   * Remove an item from the queue.
   * @returns {T} The item that was removed from the queue.
   * @throws {Exception} If the queue is empty.
   */
  public remove(): T {
    if(this[$lenof] === 0 || this[$items].length === 0) {
      throw new Exception('Cannot remove an item from an empty queue.', 'ERR_OUT_OF_BOUNDS');
    }

    this[$lenof]--;
    return this[$items].shift()!.item;
  }

  /**
   * Poll an item from the queue.
   * @returns {T | undefined} The item that was polled from the queue, or `undefined` if the queue is empty
   */
  public poll(): T | undefined {
    if(this[$lenof] === 0 || this[$items].length === 0) return undefined;

    this[$lenof]--;
    return this[$items].shift()!.item;
  }

  /**
   * Get the front item of the queue.
   * @returns {T} The front item of the queue.
   * @throws {Exception} If the queue is empty.
   */
  public element(): T {
    if(this[$lenof] === 0 || this[$items].length === 0) {
      throw new Exception('Cannot get the element from an empty queue.', 'ERR_OUT_OF_BOUNDS');
    }

    return this[$items][0].item;
  }

  /**
   * Peek at the front item of the queue.
   * @returns {T | undefined} The front item of the queue, or `undefined` if the queue is empty.
   */
  public peek(): T | undefined {
    if(this[$lenof] === 0 || this[$items].length === 0) return undefined;
    return this[$items][0].item;
  }

  /**
   * Check if the queue contains an item.
   * @param {T} item The item to check for in the queue.
   * @returns {boolean} `true` if the queue contains the item, `false` otherwise.
   */
  public contains(item: T): boolean {
    return this[$items].some(({ item: i }) => i === item);
  }

  /**
   * Check if the queue contains all the items.
   * @param {...T} items The items to check for in the queue.
   * @returns {boolean} `true` if the queue contains all the items, `false` otherwise.
   */
  public containsAll(...items: T[]): boolean {
    return items.every(item => this[$items].some(({ item: i }) => i === item));
  }

  /**
   * Search for an item in the queue.
   * @param {T} item The item to search for in the queue.
   * @returns {number} The index of the item in the queue, or `0` if the item is not found.
   */
  public search(item: T): number {
    return this[$items].findIndex(({ item: i }) => i === item) + 1;
  }

  /**
   * Convert the queue to an array.
   * @returns {T[]} An array containing the items in the queue.
   */
  public toArray(): T[] {
    return this[$items].map(({ item }) => item);
  }

  /**
   * Clear the queue.
   * @returns {void}
   */
  public clear(): void {
    this[$items].length = 0;
    this[$lenof] = 0;
  }

  public *[Symbol.iterator](): IterableIterator<T> {
    for(const { item } of this[$items]) {
      yield item;
    }
  }
}


export class MiniHeapPriorityQueue<T> {
  private [$items]: PriorityQueueItem<T>[] = [];

  public get size(): number {
    return this[$items].length;
  }

  public get isEmpty(): boolean {
    return this.size === 0;
  }

  /**
   * Adds an item to the priority queue with the given priority.
   * @param {T} item The item to add.
   * @param {number} priority The priority of the item.
   */
  public add(item: T, priority: number): void {
    this[$items].push({ priority, item });
    this.#bubbleUp();
  }

  /**
   * Removes and returns the item with the highest priority (lowest priority value).
   * Throws an error if the queue is empty.
   * @returns {T} The item with the highest priority.
   */
  public remove(): T {
    if(this[$items].length === 0) {
      throw new Exception('Cannot remove an item from an empty queue.', 'ERR_OUT_OF_BOUNDS');
    }

    // Swap the root with the last item and pop the last item
    this.#swap(0, this[$items].length - 1);
    const removedItem = this[$items].pop();
    this.#bubbleDown();

    return removedItem!.item;
  }

  /**
   * Removes and returns the item with the highest priority (lowest priority value).
   * Returns `undefined` if the queue is empty.
   * @returns {T | undefined} The item with the highest priority.
   */
  public poll(): T | undefined {
    if(this[$items].length === 0) return undefined;

    this.#swap(0, this[$items].length - 1);
    const removedItem = this[$items].pop();
    this.#bubbleDown();

    return removedItem!.item;
  }

  /**
   * Returns the item with the highest priority (lowest priority value) without removing it.
   * Throws an error if the queue is empty.
   * @returns {T} The item with the highest priority.
   */
  public element(): T {
    if(this[$items].length === 0) {
      throw new Exception('Cannot get the element from an empty queue.', 'ERR_OUT_OF_BOUNDS');
    }

    return this[$items][0].item;
  }

  /**
   * Returns the item with the highest priority (lowest priority value) without removing it.
   * Returns `undefined` if the queue is empty.
   * @returns {T | undefined} The item with the highest priority.
   */
  public peek(): T | undefined {
    return this[$items].length === 0 ? undefined : this[$items][0].item;
  }

  /**
   * Checks if the queue contains the given item.
   * @param {T} item The item to check for.
   * @returns {boolean} `true` if the item is in the queue, `false` otherwise.
   */
  public contains(item: T): boolean {
    return this[$items].findIndex(({ item: i }) => i === item) !== -1;
  }

  /**
   * Checks if the queue contains all the given items.
   * @param {...T} items The items to check for.
   * @returns {boolean} `true` if all the items are in the queue, `false` otherwise.
   */
  public containsAll(...items: T[]): boolean {
    return items.every(item => this[$items].findIndex(({ item: i }) => i === item) !== -1);
  }

  /**
   * Searches for the given item in the queue.
   * @param {T} item The item to search for.
   * @returns {number} The index of the item in the queue, or `0` if the item is not found.
   */
  public search(item: T): number {
    return this[$items].findIndex(({ item: i }) => i === item) + 1;
  }

  /**
   * Converts the priority queue to an array.
   * @returns {T[]} An array containing the items in the priority queue.
   */
  public toArray(): T[] {
    return this[$items].map(({ item }) => item);
  }

  /**
   * Clears the priority queue.
   */
  public clear(): void {
    this[$items].length = 0;
  }

  public *[Symbol.iterator](): IterableIterator<T> {
    for(const { item } of this[$items]) {
      yield item;
    }
  }

  /**
   * Moves the last added item up the heap to maintain the min-heap property.
   */
  #bubbleUp(): void {
    let index = this[$items].length - 1;

    while(index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if(this[$items][index].priority >= this[$items][parentIndex].priority) break;

      this.#swap(index, parentIndex);
      index = parentIndex;
    }
  }

  /**
   * Moves the root item down the heap to maintain the min-heap property after removal.
   */
  #bubbleDown(): void {
    let index = 0;
    const length = this[$items].length;

    // eslint-disable-next-line no-constant-condition
    while(true) {
      const leftChildIndex = 2 * index + 1;
      const rightChildIndex = 2 * index + 2;
      let smallest = index;

      // Check if the left child is smaller
      if(leftChildIndex < length && this[$items][leftChildIndex].priority < this[$items][smallest].priority) {
        smallest = leftChildIndex;
      }

      // Check if the right child is smaller
      if(rightChildIndex < length && this[$items][rightChildIndex].priority < this[$items][smallest].priority) {
        smallest = rightChildIndex;
      }

      // If the smallest element is the current element, stop
      if(smallest === index) break;

      // Otherwise, swap and continue bubbling down
      this.#swap(index, smallest);
      index = smallest;
    }
  }

  /**
   * Swaps two elements in the heap array.
   * @param {number} i The index of the first element.
   * @param {number} j The index of the second element.
   */
  #swap(i: number, j: number): void {
    const temp = this[$items][i];
    this[$items][i] = this[$items][j];
    this[$items][j] = temp;
  }
}
