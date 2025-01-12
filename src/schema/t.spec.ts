import { t } from './t';


describe('Tests for schema validator `t`', () => {
  describe('t.any()', () => {
    test('should parse any value correctly', () => {
      const schema = t.any();
      const values = [null, undefined, 42, 'string', { key: 'value' }, [1, 2, 3]];

      for(let i = 0; i < values.length; i++) {
        expect(schema.parse(values[i])).toBe(values[i]);
        expect(schema.validate(values[i])).toBe(true);
      }
    });
  });

  describe('t.string()', () => {
    test('should enforce minLength correctly', () => {
      const schema = t.string().minLength(5);

      expect(() => schema.parse('abc')).toThrow('Expected a string with at least 5 characters');
      expect(schema.parse('abcde')).toBe('abcde');
    });

    test('should enforce maxLength correctly', () => {
      const schema = t.string().maxLength(3);

      expect(() => schema.parse('abcde')).toThrow('Expected a string with length less than or equals 3');
      expect(schema.parse('abc')).toBe('abc');
    });

    test('should enforce exact length correctly', () => {
      const schema = t.string().length(4);

      expect(() => schema.parse('abcdef')).toThrow('Expected a string with exactly 4 characters');
      expect(schema.parse('abcd')).toBe('abcd');
    });

    test('should validate email format', () => {
      const schema = t.string().email();

      expect(() => schema.parse('not-an-email')).toThrow('Expected a string matching the email pattern');
      expect(schema.parse('test@example.com')).toBe('test@example.com');
    });

    test('should validate IPv4 format', () => {
      const schema = t.string().ipv4();

      expect(() => schema.parse('not-an-ip-addr')).toThrow('Expected a string matching the IPv4 pattern');
      expect(schema.parse('127.0.0.1')).toBe('127.0.0.1');
    });

    test('should validate IPv6 format', () => {
      const schema = t.string().ipv6();

      const validAddresses = [
        '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
        '2001:0db8:1234:5678:9abc:def0:1234:abcd',
      ];

      expect(() => schema.parse('not-an-ip-addr')).toThrow('Expected a string matching the IPv6 pattern');
      
      for(let i = 0; i < validAddresses.length; i++) {
        expect(schema.parse(validAddresses[i])).toBe(validAddresses[i]);
      }
    });

    test('should validate URL format', () => {
      const schema = t.string().url();

      const validUrls = [
        'https://google.com/search?q=TSC',
        'https://127.0.0.1/web',
        'wss://localhost:5511/socket.io',
        'ftps://host.com:443/b/[FID]?disableCache=1',
      ];

      expect(() => schema.parse('not-an-url')).toThrow('Expected a string matching the URL pattern');
      
      for(let i = 0; i < validUrls.length; i++) {
        expect(schema.parse(validUrls[i])).toBe(validUrls[i]);
      }
    });

    test('should validate the base64 format', () => {
      const schema = t.string().base64();
      const value = Buffer.from('Something else, not hello world :|').toString('base64');

      expect(() => schema.parse('not-a-base64')).toThrow('Expected a string matching the base64 pattern');
      expect(schema.parse(value)).toBe(value);
    });

    test('should validate the base64url format', () => {
      const schema = t.string().base64url();
      const value = Buffer.from('Something else, not hello world :|').toString('base64url');

      expect(() => schema.parse('not-a-base64+/==')).toThrow('Expected a string matching the base64url pattern');
      expect(schema.parse(value)).toBe(value);
    });

    test('should enforce startsWith correctly', () => {
      const schema = t.string().startsWith('Some');
      
      expect(() => schema.parse('string')).toThrow('Expected a string starting with `Some`');
      expect(schema.parse('Something')).toBe('Something');
    });

    test('should enforce endsWith correctly', () => {
      const schema = t.string().endsWith('thing');
      
      expect(() => schema.parse('string')).toThrow('Expected a string ending with `thing`');
      expect(schema.parse('Something')).toBe('Something');
    });

    test('should enforce includes correctly', () => {
      const schema = t.string().includes('thing');
      
      expect(() => schema.parse('string')).toThrow('The target string must includes `thing`');
      expect(schema.parse('Something new')).toBe('Something new');
    });

    test('should enforce regular expression patterns correctly', () => {
      const pattern = /^time:\d{2}$/;
      const schema = t.string().pattern(pattern);

      expect(() => schema.parse('string')).toThrow(`Expected a string matching this pattern: ${pattern}`);
      expect(schema.parse('time:02')).toBe('time:02');
    });

    test('should enforce dates correctly', () => {
      const schema = t.string().date();

      const validDates = [
        '2025-01-01',
        new Date().toISOString(),
        new Date().toUTCString(),
        new Date().toString(),
      ];

      expect(() => schema.parse('-1 is not a date')).toThrow('Expected a string matching the date pattern');
      expect(() => schema.parse(Date.now().toString())).toThrow('Expected a string matching the date pattern');
      
      for(let i = 0; i < validDates.length; i++) {
        expect(schema.parse(validDates[i])).toBe(validDates[i]);
      }
    });

    test('should enforce timestamps correctly', () => {
      const schema = t.string().timestamp();
      const ts = [ Date.now().toString(), new Date().toISOString() ];

      expect(() => schema.parse('-1 is not a timestamp')).toThrow('Expected a string matching the timestamp pattern');
      
      for(let i = 0; i < ts.length; i++) {
        expect(schema.parse(ts[i])).toBe(ts[i]);
      }
    });

    test('should enforce enum constraint correctly', () => {
      const e = ['some', 'thing', 'new', 'about', 'hello', 'world'];
      const schema = t.string().oneOf(e);
      
      expect(() => schema.parse('something')).toThrow(`The value must be a member of enum [${e.join(', ')}]`);
      expect(schema.parse('some')).toBe('some');
      expect(schema.parse('new')).toBe('new');
    });

    test('should handle optional value correctly', () => {
      const schema = t.string().default('Something');

      expect(schema.parse()).toBe('Something');
      expect(schema.parse('strtr')).toBe('strtr');
    });

    test('should handle null and/or undefined values correctly', () => {
      const s1 = t.string()
        .optional()
        .default('Something');

      const s2 = t.string()
        .nullable();

      expect(() => s1.parse(null)).toThrow('Expected value as \'typeof string\'');
      expect(() => s2.parse()).toThrow('Expected value as \'typeof string\'');

      expect(s1.parse('Some')).toBe('Some');
      expect(s2.parse('Some')).toBe('Some');
      expect(s2.parse(null)).toBe(null);
    });
  });

  describe('t.number()', () => {
    test('should enforce min correctly', () => {
      const schema = t.number().min(3);

      expect(() => schema.parse(0)).toThrow('Expected a value greater than or equals to 3');
      expect(schema.parse(3)).toBe(3);
      expect(schema.parse(10)).toBe(10);
    });

    test('should enforce max correctly', () => {
      const schema = t.number().max(5);

      expect(() => schema.parse(10)).toThrow('Expected a value less than or equals to 5');
      expect(schema.parse(3)).toBe(3);
      expect(schema.parse(5)).toBe(5);
    });

    test('should enforce a integer number correctly', () => {
      const schema = t.number().int();

      expect(() => schema.parse(10.5)).toThrow('Expected a integer number');
      expect(schema.parse(3)).toBe(3);
      expect(schema.parse(-2)).toBe(-2);
    });

    test('should enforce a unsigned integer number correctly', () => {
      const schema = t.number().uint();

      expect(() => schema.parse(10.5)).toThrow('Expected a unsigned integer number');
      expect(() => schema.parse(-10)).toThrow('Expected a unsigned integer number');

      expect(schema.parse(3)).toBe(3);
      expect(schema.parse(0)).toBe(0);
    });

    test('should enforce a decimal number correctly', () => {
      const schema = t.number().decimal();

      expect(() => schema.parse(10)).toThrow('Expected a decimal number');
      expect(() => schema.parse(-10)).toThrow('Expected a decimal number');
      expect(() => schema.parse(10.0)).toThrow('Expected a decimal number');

      expect(schema.parse(0.5)).toBe(0.5);
    });

    test('should enforce enum constraint correctly', () => {
      const e = [10, 20, -1, 0.55];
      const schema = t.number().oneOf(e);

      expect(() => schema.parse(101)).toThrow(`The value must be a member of enum [${e.join(', ')}]`);
      expect(schema.parse(-1)).toBe(-1);
      expect(schema.parse(0.55)).toBe(0.55);
    });
  });

  describe('t.object()', () => {
    test('should handle a object shape with many types of properties', () => {
      const schema = t.object({
        key: t.string().minLength(4),
        maybe: t.string().optional(),
        makeItNull: t.number().uint().nullable().max(10),
        nestedArray: t.array([t.string()]).equals(['string']),
      });

      const valid = {
        key: 'some value',
        makeItNull: null!,
        nestedArray: ['string'],
      };

      const invalid = {
        key: 'some value',
        nestedArray: [],
      };

      expect(() => schema.parse(invalid)).toThrow();
      expect(schema.parse(valid)).toStrictEqual({ ...valid, maybe: void 0 });
    });
  });
});
