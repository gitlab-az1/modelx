import { MiniHeapPriorityQueue } from './queue';


describe('Queue:mini-heap-priority', () => {
  test('it should be ok', () => {
    expect(25 ** 0.5).toBe(5);
  });
  
  test('should be able to add items to the queue', () => {
    const queue = new MiniHeapPriorityQueue<number>();

    queue.add(1, 1);
    queue.add(2, 2);
    queue.add(3, 0);

    expect(queue.toArray()).toStrictEqual([3, 1, 2]);
  });

  test('should be able to remove items from the queue', () => {
    const queue = new MiniHeapPriorityQueue<number>();

    queue.add(1, 1);
    queue.add(2, 2);

    expect(queue.poll()).toBe(1);
    expect(queue.poll()).toBe(2);
    expect(queue.poll()).toBe(undefined);
  });

  test('should be able to get the size of the queue', () => {
    const queue = new MiniHeapPriorityQueue<number>();

    queue.add(1, 1);
    queue.add(2, 2);

    expect(queue.size).toBe(2);
  });
});
