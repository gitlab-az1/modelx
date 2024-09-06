
/**
 * Represents a stack data structure.
 * 
 * @template T The type of elements in the stack.
 */
export class Stack<T> {
  #items: T[];
  readonly #maxSize: number | null;

  public constructor(length: number, iterable?: Iterable<T>);
  public constructor(iterable?: Iterable<T>);
  public constructor(_iterableOrLength?: Iterable<T> | number, _iterable?: Iterable<T>) {
    this.#items = typeof _iterableOrLength === 'number' ? 
      new Array(_iterableOrLength) : [];

    const iter = typeof _iterableOrLength === 'number' ? 
      _iterableOrLength : _iterable;

    this.#maxSize = typeof _iterableOrLength === 'number' ? _iterableOrLength : null;
    if(!iter) return;
    
    Array.prototype.forEach.call(iter, this.push.bind(this));
  }

  /**
   * Whether the stack is empty.
   */
  public get isEmpty(): boolean {
    return this.#items.length === 0;
  }

  /**
   * The number of items in the stack.
   */
  public get size(): number {
    return this.#items.length;
  }

  public get maxSize(): number | null {
    return this.#maxSize;
  }

  /**
   * Return the top item from the stack without removing it.
   * @returns The top item from the stack, or `undefined` if the stack is empty.
   */
  public peek(): T | undefined {
    return this.#items[this.#items.length - 1];
  }

  /**
   * Remove and return the top item from the stack.
   * @returns The top item from the stack, or `undefined` if the stack is empty. 
   */
  public next(): T | undefined {
    return this.#items.pop();
  }

  /**
   * Return the 1-based position of the item in the stack.
   * @param {T} item The item to search for.
   */
  public search(item: T): number {
    const index = this.#items.indexOf(item);
    return index >= 0 ? index + 1 : 0; // Return 0 when item is not found
  }

  public indexOf(item: T): number {
    return this.#items.indexOf(item);
  }

  /**
   * Push an item to the top of the stack.
   * @param {T} item The item to push.
   */
  public push(item: T): void {
    this.#items.push(item);
  }

  public pushAll(...items: T[]): void {
    this.#items.push(...items);
  }

  /**
   * Whether the specified element is present in the stack.
   * @param {T} item The item to search for.
   * @returns {boolean} A boolean flag that indicates if the element is in stack.
   */
  public contains(item: T): boolean {
    return this.#items.indexOf(item) >= 0;
  }

  /**
   * Return the item at the specified index.
   * 
   * WARNING: This method is 0-based, unlike the `atPosition` method.
   * 
   * @param {number} index The index of the item to return.
   * @returns The item at the specified index, or `undefined` if the index is out of bounds.
   */
  public at(index: number): T | undefined {
    return this.#items[index];
  }

  /**
   * Return the item at the specified position in the stack.
   * @param {number} position The 1-based position of the item to return.
   * @returns The item at the specified position, or `undefined` if the position is out of bounds.
   */
  public atPosition(position: number): T | undefined {
    return this.#items[position - 1];
  }

  /**
   * Convert the stack to an array.
   * @returns An array containing the items in the stack.
   */
  public toArray(): T[] {
    return [ ...this.#items ];
  }

  /**
   * Remove all items from the stack.
   */
  public clear(): void {
    this.#items = null!;
    this.#items = [];
  }

  public *[Symbol.iterator]() {
    for(let i = this.#items.length - 1; i >= 0; i--) {
      yield this.#items[i];
    }
  }
}

export default Stack;
