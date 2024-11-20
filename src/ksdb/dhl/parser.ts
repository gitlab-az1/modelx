import Lexer from './lexer';
import { Program, Statement } from './ast';
import { Token, TokenType } from './tokens';
import { Exception } from '../../@internals/errors';


export class Parser {
  #cursor: number;
  #currentToken: Token;
  readonly #tokens: readonly Token[];

  #cachedProgram: Program | null;

  public constructor(tokens: Lexer | readonly Token[]) {
    if(Array.isArray(tokens) && !(tokens instanceof Lexer)) {
      throw new Exception('Cannot determinate token source for dhl parser', 'ERR_INVALID_ARGUMENT');
    }

    this.#tokens = tokens instanceof Lexer ? tokens.tokenize() : tokens;
    this.#cachedProgram = null;

    this.#cursor = 0;
    this.#currentToken = this.#tokens[this.#cursor];
  }

  public get eof(): boolean {
    return this.#eof();
  }

  public parse(): Program {
    if(!!this.#cachedProgram && this.#cachedProgram.kind === 'Program') return { ...this.#cachedProgram };

    const body = [] as Statement[];

    while(!this.#eof()) {
      body.push(this.#parseStatement());
    }

    const programExpression: Program = {
      kind: 'Program',
      body,
    };

    this.#cachedProgram = programExpression;
    return programExpression;
  }

  #parseStatement(): Statement {
    return { kind: 'Symbol', symbol: 'void 0' } as any;
  }

  // @ts-expect-error The method Parser#next() is never used yet.
  #next(): void {
    this.#cursor++;
    this.#currentToken = this.#tokens[this.#cursor] || { type: TokenType.EOF, value: 'eof' };
  }

  #eof(): boolean {
    return this.#currentToken.type === TokenType.EOF;
  }
}

export default Parser;
