import {
  isNone,
  isSome,
  optionalCatch,
  optionalResolve,
  unwrap,
  unwrapExpect,
  unwrapOr,
  some,
  none,
  optionalDefined,
} from './option';


describe('Option', () => {
  test('it should be ok', () => {
    expect(25 ** 0.5).toBe(5);
  });

  test('should return true if the option is some', () => {
    expect(isSome(some('abc'))).toBe(true);
  });

  test('should return false if the option is none', () => {
    expect(isNone(none)).toBe(true);
  });

  test('should return some value', () => {
    expect(unwrap(some('abc'))).toBe('abc');
  });

  test('should throw an exception if the option is none', () => {
    expect(() => unwrap(none)).toThrow();
  });

  test('should return the value if the option is some', () => {
    expect(unwrapOr(some('abc'), 'fallback')).toBe('abc');
  });

  test('should return the fallback value if the option is none', () => {
    expect(unwrapOr(none, 'fallback')).toBe('fallback');
  });

  test('should return the value if the option is some', () => {
    expect(unwrapExpect(some('abc'))).toBe('abc');
  });

  test('should throw an exception if the option is none', () => {
    expect(() => unwrapExpect(none)).toThrow();
  });

  test('should return some value', () => {
    expect(optionalCatch(() => 'abc')).toEqual(some('abc'));
  });

  test('should return none if an exception is thrown', () => {
    expect(optionalCatch(() => { throw new Error(); })).toEqual(none);
  });

  test('should return some value', async () => {
    expect(await optionalResolve(Promise.resolve('abc'))).toEqual(some('abc'));
  });

  test('should return none if an exception is thrown', async () => {
    expect(await optionalResolve(Promise.reject())).toEqual(none);
  });

  test('should return some value', () => {
    expect(optionalDefined('abc')).toEqual(some('abc'));
  });

  test('should return none if the value is null', () => {
    expect(optionalDefined(null)).toEqual(none);
  });

  test('should return none if the value is undefined', () => {
    expect(optionalDefined(undefined)).toEqual(none);
  });
});
