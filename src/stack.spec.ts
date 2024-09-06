import Stack from './stack';


describe('Stack', () => {
  test('it should be ok', () => {
    expect(25 ** 0.5).toBe(5);
  });

  test('should be able to push items to the stack', () => {
    const s = new Stack<number>();

    s.push(1);
    s.push(2);
    s.push(3);

    expect(s.toArray()).toStrictEqual([1, 2, 3]);
  });

  test('should be able to pop items from the stack', () => {
    const s = new Stack<number>();

    s.push(1);
    s.push(2);
    s.push(3);

    expect(s.next()).toBe(3);
    expect(s.next()).toBe(2);
    expect(s.next()).toBe(1);
  });

  test('should be able to peek at the top item of the stack', () => {
    const s = new Stack<number>();

    s.push(1);
    s.push(2);
    s.push(3);

    expect(s.peek()).toBe(3);
    expect(s.peek()).toBe(3);
  });

  test('should be able to search for an item in the stack', () => {
    const s = new Stack<number>();

    s.push(1);
    s.push(2);
    s.push(3);

    expect(s.search(2)).toBe(2);
    expect(s.search(4)).toBe(0);
  });

  test('should be able to get the index of an item in the stack', () => {
    const s = new Stack<number>();

    s.push(1);
    s.push(2);
    s.push(3);

    expect(s.indexOf(2)).toBe(1);
    expect(s.indexOf(4)).toBe(-1);
  });

  test('should be able to get the size of the stack', () => {
    const s = new Stack<number>();

    s.push(1);
    s.push(2);
    s.push(3);

    expect(s.size).toBe(3);
  });

  test('should be able to check if the stack is empty', () => {
    const s = new Stack<number>();

    expect(s.isEmpty).toBe(true);

    s.push(1);

    expect(s.isEmpty).toBe(false);
  });

  test('should be able to get the item at a specific index', () => {
    const s = new Stack<number>();

    s.push(1);
    s.push(2);
    s.push(3);

    expect(s.at(0)).toBe(1);
    expect(s.at(1)).toBe(2);
    expect(s.at(2)).toBe(3);
    expect(s.at(3)).toBe(undefined);
  });

  test('should be able to convert the stack to an array', () => {
    const s = new Stack<number>();

    s.push(1);
    s.push(2);
    s.push(3);

    expect(s.toArray()).toEqual([1, 2, 3]);
  });

  test('should be able to clear the stack', () => {
    const s = new Stack<number>();

    s.push(1);
    s.push(2);
    s.push(3);

    s.clear();

    expect(s.isEmpty).toBe(true);
  });
});
