import { TokenType, Token } from './tokens';
import { Exception } from '../../@internals/errors';
import { ReadonlyDict } from '../../@internals/types';
import { IDisposable } from '../../@internals/disposable';


const keywords: ReadonlyDict<TokenType> = {
  do: TokenType.Do,
  fetch: TokenType.Fetch,
  from: TokenType.From,
  insert: TokenType.Insert,
  update: TokenType.Update,
  upsert: TokenType.Upsert,
  delete: TokenType.Delete,
  truncate: TokenType.Truncate,
  where: TokenType.Where,
  match: TokenType.Match,
  not: TokenType.Not,
  into: TokenType.Into,
  with: TokenType.With,
  without: TokenType.Without,
  values: TokenType.Values,
  as: TokenType.As,
  transaction: TokenType.Transaction,
  abort: TokenType.Abort,
  commit: TokenType.Commit,
  rollback: TokenType.Rollback,
  if: TokenType.If,
  else: TokenType.Else,
  then: TokenType.Then,
  symbol: TokenType.Symbol,
  while: TokenType.While,
  for: TokenType.For,
  null: TokenType.Null,
  call: TokenType.Call,
  close: TokenType.Close,
  drop: TokenType.Drop,
  show: TokenType.Show,
  columns: TokenType.Columns,
  and: TokenType.And,
  or: TokenType.Or,
  contains: TokenType.Contains,
  sort: TokenType.Sort,
  order: TokenType.Order,
  by: TokenType.By,
  asc: TokenType.Asc,
  desc: TokenType.Desc,
  limit: TokenType.Limit,
  offset: TokenType.Offset,
};

const mathOperators: readonly string[] = [
  '+', '-', '*', '/', '%',
];

const ignorables: readonly string[] = [
  ' ', '\n', '\r', '\r\n', '\t',
];

const controls: ReadonlyDict<TokenType> = {
  ';': TokenType.SemiColon,
  '=': TokenType.Equals,
  ',': TokenType.Comma,
  ':': TokenType.Colon,
  '.': TokenType.Dot,
};


export type LexerProps = {
  filename?: string;
}

export class Lexer implements IDisposable {
  #cursor: number;
  #line: number;
  #column: number;
  #char: string | null;
  #characters: readonly string[];

  #source: string;
  #filename?: string;

  #disposed: boolean;
  #cachedTokens: readonly Token[] | null;

  public constructor(source: string | Buffer, props?: LexerProps) {
    this.#source = source.toString();
    this.#filename = props?.filename;

    this.#line = 1;
    this.#column = 1;
    this.#cursor = 0;
    
    this.#disposed = false;
    this.#cachedTokens = null;
    this.#characters = this.#source.split('');
    this.#char = this.#characters[this.#cursor];
  }

  public get source(): string {
    if(this.#disposed) {
      throw new Exception('This `lexer` instance was already disposed', 'ERR_RESOURCE_DISPOSED');
    }

    return this.#source.slice(0);
  }

  public get filename(): string | null {
    if(this.#disposed) return null;
    return this.#filename?.slice(0) || null;
  }

  public tokenize(): Token[] {
    return this.#tokenizeSourceOrCached();
  }

  public tokenizeWithoutCache(): Token[] {
    return this.#tokenizeSource();
  }

  #tokenizeSourceOrCached(): Token[] {
    if(this.#disposed) {
      throw new Exception('This `lexer` instance was already disposed', 'ERR_RESOURCE_DISPOSED');
    }

    if(!!this.#cachedTokens && Array.isArray(this.#cachedTokens)) return [ ...this.#cachedTokens ];
    return this.#tokenizeSource();
  }

  #tokenizeSource(): Token[] {
    if(this.#disposed) {
      throw new Exception('This `lexer` instance was already disposed', 'ERR_RESOURCE_DISPOSED');
    }

    const tokens = [] as Token[];

    while(this.#char != null && this.#cursor < this.#characters.length) {
      const isPowerOperator = this.#char === '*' && this.#characters[this.#cursor + 1] === '*';

      if(ignorables.includes(this.#char)) {
        this.#processIgnorables();
      } else if(this.#char === ':') {
        if(this.#characters[this.#cursor + 1] === ':') {
          tokens.push(this.#createToken(TokenType.CastOperator, '::'));
          this.#next(2); // Skip over '::'
        } else {
          this.#next();
        }
      } else if(this.#char === '(') {
        tokens.push(this.#createToken(TokenType.OpenParen, '('));
        this.#next();
      } else if(this.#char === ')') {
        tokens.push(this.#createToken(TokenType.CloseParen, ')'));
        this.#next();
      } else if(this.#char === '[') {
        tokens.push(this.#createToken(TokenType.OpenBrace, '['));
        this.#next();
      } else if(this.#char === ']') {
        tokens.push(this.#createToken(TokenType.CloseBrace, ']'));
        this.#next();
      } else if(controls[this.#char]) {
        tokens.push(this.#createToken(controls[this.#char], this.#char));
        this.#next();
      } else if(this.#isLetter(this.#char)) {
        tokens.push(this.#processKeywordOrIdentifier());
      } else if(this.#char === '\'' || this.#char === '`') {
        tokens.push(this.#processStringLiteral());
      } else if(this.#isDigit(this.#char) || (this.#char === '-' && (this.#cursor === 0 || !this.#isDigit(this.#characters[this.#cursor - 1])))) {
        tokens.push(this.#processNumber());
      } else if(mathOperators.includes(this.#char) || isPowerOperator) {
        tokens.push(this.#createToken(TokenType.BinaryOperator, isPowerOperator ? '**' : this.#char));
        this.#next(isPowerOperator ? 2 : 1);
      } else if(this.#char === '$' && this.#isDigit(this.#characters[this.#cursor + 1])) {
        this.#next();
        const num = this.#processNumber();

        tokens.push(this.#createToken(TokenType.BindingOperator, `$${num.value}`));
      } else {
        throw new Exception(`Unexpected character: ${this.#char} at line ${this.#line}, column ${this.#column}`, 'ERR_UNEXPECTED_TOKEN');
      }
    }

    tokens.push(this.#createToken(TokenType.EOF, 'eof'));

    this.#cachedTokens = tokens;
    return tokens;
  }

  #processKeywordOrIdentifier(): Token {
    const start = this.#cursor;

    while(this.#isLetterOrDigit(this.#char) || this.#char === '_') {
      this.#next();
    }
  
    const value = this.#source.slice(start, this.#cursor); // Original case
    const type = keywords[value.toLowerCase()] || TokenType.Identifier; // Lowercase for matching
    return this.#createToken(type, value); // Preserve original case in token
  }

  #processStringLiteral(): Token {
    let value = '';
    this.#next(); // Skip opening '

    while(this.#char !== '\'' && this.#char !== '`' && this.#char != null) {
      value += this.#char;
      this.#next();
    }

    if(this.#char !== '\'' && this.#char !== '`') {
      throw new Exception(`Unterminated string literal at line ${this.#line}, column ${this.#column}`, 'ERR_UNEXPECTED_TOKEN');
    }

    this.#next(); // Skip closing '
    return this.#createToken(TokenType.String, value);
  }

  #processNumber(): Token {  
    let isNegative = false;

    if(this.#char === '-') {
      isNegative = true;
      this.#next(); // Skip the minus sign
    }
  
    // Check for hexadecimal, octal, or binary number prefixes
    let value = '';
    let base10Value: number;
  
    if(this.#char === '0' && (this.#characters[this.#cursor + 1] === 'x' || this.#characters[this.#cursor + 1] === 'X')) {
      // Hexadecimal (0x or 0X)
      value += '0x';

      this.#next(); // Skip '0'
      this.#next(); // Skip 'x' or 'X'

      while(/[0-9a-fA-F]/.test(this.#char)) {
        value += this.#char;
        this.#next();
      }

      // Convert to base 10
      base10Value = parseInt(value.slice(2), 16);
    } else if(this.#char === '0' && (this.#characters[this.#cursor + 1] === 'o' || this.#characters[this.#cursor + 1] === 'O')) {
      // Octal (0o or 0O)
      value += '0o';

      this.#next(); // Skip '0'
      this.#next(); // Skip 'o' or 'O'

      while(/[0-7]/.test(this.#char)) {
        value += this.#char;
        this.#next();
      }

      // Convert to base 10
      base10Value = parseInt(value.slice(2), 8);
    } else if(this.#char === '0' && (this.#characters[this.#cursor + 1] === 'b' || this.#characters[this.#cursor + 1] === 'B')) {
      // Binary (0b or 0B)
      value += '0b';

      this.#next(); // Skip '0'
      this.#next(); // Skip 'b' or 'B'

      while(/[01]/.test(this.#char)) {
        value += this.#char;
        this.#next();
      }
      // Convert to base 10
      base10Value = parseInt(value.slice(2), 2);
    } else {
      // Standard decimal number
      while(this.#isDigit(this.#char)) {
        value += this.#char;
        this.#next();
      }
  
      // Handle floating-point numbers (e.g., 123.45)
      if(this.#char === '.') {
        value += this.#char;
        this.#next();

        while(this.#isDigit(this.#char)) {
          value += this.#char;
          this.#next();
        }
      }
  
      // Handle scientific notation (e.g., 1e3, 2.5e-4)
      if(this.#char === 'e' || this.#char === 'E') {
        value += this.#char;
        this.#next();

        if((<string>this.#char) === '+' || (<string>this.#char) === '-') {
          value += this.#char;
          this.#next();
        }

        while(this.#isDigit(this.#char)) {
          value += this.#char;
          this.#next();
        }
      }
      
      // Convert the decimal number to base 10
      base10Value = parseFloat(value);
    }
  
    // If the number is negative, apply the negative sign
    if(isNegative) {
      base10Value = -base10Value;
    }

    const finalValue = base10Value.toString();
  
    // Convert to string for the token
    return this.#createToken(finalValue.includes('.') ? TokenType.Decimal : TokenType.Integer, finalValue);
  }  

  #isLetter(char: string | null): boolean {
    return !!char && /^[a-zA-Z]$/.test(char);
  }

  #isDigit(char: string | null): boolean {
    return !!char && /^[0-9]$/.test(char);
  }

  #isLetterOrDigit(char: string | null): boolean {
    return this.#isLetter(char) || this.#isDigit(char);
  }

  #processIgnorables(): void {
    if(this.#char === '\n') {
      this.#line++;
      this.#column = 1;
    } else if(this.#char === '\r' && this.#characters[this.#cursor + 1] === '\n') {
      this.#line++;
      this.#column = 1;
      
      this.#next();
    } else if(this.#char === '\t') {
      this.#column += 4;
    } else if(this.#char === ' ') {
      this.#column++;
    }

    this.#next();
  }

  #createToken(type: TokenType, value: string): Token {
    return {
      type,
      value,
      locationInSource: this.#loc(),
    };
  }

  #loc(): Token['locationInSource'] {
    return {
      line: this.#line,
      column: this.#column,
      position: this.#cursor,
      filename: this.#filename,
    };
  }

  #next(steps: number = 1): void {
    this.#column += steps;
    this.#cursor += steps;
    this.#char = this.#cursor < this.#characters.length ? this.#characters[this.#cursor] : null;
  }

  public dispose(): void {
    if(this.#disposed) return;

    this.#cursor = -1;
    this.#line = -1;
    this.#column = -1;
    this.#char = null;
    this.#characters = [];
    
    this.#source = '';
    this.#filename = undefined;
    
    this.#cachedTokens = null;

    this.#disposed = true;
  }
}

export default Lexer;
