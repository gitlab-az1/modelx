import { WeakQueue } from './queue';


describe('Queue:weak', () => {
  test('it should be ok', () => {
    expect(25 ** 0.5).toBe(5);
  });

  test('should be able to add items to the queue', () => {
    const queue = new WeakQueue<number>();

    queue.add(1);
    queue.add(2);
    queue.add(3);

    expect(queue.toArray()).toStrictEqual([1, 2, 3]);
  });

  test('should be able to keep a max-value', () => {
    const queue = new WeakQueue<number>(3);
    expect(queue.maxSize).toBe(3);

    expect(queue.offer(1)).toBe(true);
    expect(queue.offer(2)).toBe(true);
    expect(queue.offer(3)).toBe(true);
    expect(queue.offer(4)).toBe(false);

    expect(queue.toArray()).toStrictEqual([1, 2, 3]);

    queue.remove();
    queue.remove();

    expect(queue.offer(4)).toBe(true);
    expect(queue.offer(5)).toBe(true);
    expect(queue.offer(6)).toBe(false);
  });

  test('should be able to initialize the queue with items', () => {
    const queue = new WeakQueue<number>([1, 2, 3]);
    expect(queue.toArray()).toStrictEqual([1, 2, 3]);
  });

  test('should be able to remove items from the queue', () => {
    const queue = new WeakQueue<number>();

    queue.add(1);
    queue.add(2);

    expect(queue.poll()).toBe(1);
    expect(queue.poll()).toBe(2);
    expect(queue.poll()).toBe(undefined);
  });

  test('should be able to get the size of the queue', () => {
    const queue = new WeakQueue<number>();

    queue.add(1);
    queue.add(2);

    expect(queue.size).toBe(2);
  });

  test('should be able to peek at the front item of the queue', () => {
    const queue = new WeakQueue<number>();

    queue.add(1);
    queue.add(2);

    expect(queue.peek()).toBe(1);
    expect(queue.peek()).toBe(1);
  });

  test('should be able to get the front item of the queue', () => {
    const queue = new WeakQueue<number>();

    queue.add(1);
    queue.add(2);

    expect(queue.element()).toBe(1);
    expect(queue.element()).toBe(1);
  });

  test('should be able to search for an item in the queue', () => {
    const queue = new WeakQueue<number>();

    queue.add(1);
    queue.add(2);
    queue.add(3);

    expect(queue.search(2)).toBe(2);
    expect(queue.search(4)).toBe(0);
  });

  test('should be able to check if the queue contains an item', () => {
    const queue = new WeakQueue<number>();

    queue.add(1);
    queue.add(2);
    queue.add(3);

    expect(queue.contains(2)).toBe(true);
    expect(queue.contains(4)).toBe(false);
  });

  test('should be able to check if the queue contains all items', () => {
    const queue = new WeakQueue<number>();

    queue.add(1);
    queue.add(2);
    queue.add(3);

    expect(queue.containsAll(2, 3)).toBe(true);
    expect(queue.containsAll(2, 4)).toBe(false);
  });

  test('should be able to add multiple items to the queue', () => {
    const queue = new WeakQueue<number>();

    queue.addAll(1, 2, 3);

    expect(queue.toArray()).toStrictEqual([1, 2, 3]);
  });

  test('should be able to clear the queue', () => {
    const queue = new WeakQueue<number>();

    queue.add(1);
    queue.add(2);
    queue.add(3);

    queue.clear();

    expect(queue.size).toBe(0);
  });

  test('should be able to check if the queue is empty', () => {
    const queue = new WeakQueue<number>();

    expect(queue.isEmpty).toBe(true);

    queue.add(1);

    expect(queue.isEmpty).toBe(false);
  });
});
