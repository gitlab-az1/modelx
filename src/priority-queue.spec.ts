import { PriorityQueue } from './queue';


describe('Queue:priority', () => {
  test('it should be ok', () => {
    expect(25 ** 0.5).toBe(5);
  });
  
  test('should be able to add items to the queue', () => {
    const queue = new PriorityQueue<number>();

    queue.add(1, 1);
    queue.add(2, 2);
    queue.add(3, 0);

    expect(queue.toArray()).toStrictEqual([3, 1, 2]);
  });

  test('should be able to keep a max-value', () => {
    const queue = new PriorityQueue<number>(3);
    expect(queue.maxSize).toBe(3);

    expect(queue.offer(1, 1)).toBe(true);
    expect(queue.offer(2, 2)).toBe(true);
    expect(queue.offer(3, 0)).toBe(true);
    expect(queue.offer(4, 4)).toBe(false);

    expect(queue.toArray()).toStrictEqual([3, 1, 2]);

    queue.remove();
    queue.remove();

    expect(queue.offer(4, 4)).toBe(true);
    expect(queue.offer(5, 5)).toBe(true);
    expect(queue.offer(6, 6)).toBe(false);
  });

  test('should be able to remove items from the queue', () => {
    const queue = new PriorityQueue<number>();

    queue.add(1, 1);
    queue.add(2, 2);

    expect(queue.poll()).toBe(1);
    expect(queue.poll()).toBe(2);
    expect(queue.poll()).toBe(undefined);
  });

  test('should be able to get the size of the queue', () => {
    const queue = new PriorityQueue<number>();

    queue.add(1, 1);
    queue.add(2, 2);

    expect(queue.size).toBe(2);
  });
});
