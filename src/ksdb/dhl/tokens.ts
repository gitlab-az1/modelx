export const enum TokenType {
  Integer,
  Decimal,
  String,
  Identifier,
  Equals,
  OpenParen,
  CloseParen,
  OpenBrace,
  CloseBrace,
  OpenBracket,
  CloseBracket,
  BinaryOperator,
  UnrayOperator,
  BindingOperator,
  CastOperator,
  
  // Keywords
  Symbol,
  If,
  Then,
  Else,
  While,
  For,
  Do,
  Null,
  Fetch,
  From,
  Insert,
  Update,
  Upsert,
  Delete,
  Truncate,
  Where,
  Match,
  Not,
  Into,
  With,
  Without,
  Values,
  As,
  Transaction,
  Abort,
  Commit,
  Rollback,
  Call,
  Close,
  Drop,
  Show,
  Columns,
  And,
  Or,
  Contains,
  Sort,
  Order,
  By,
  Asc,
  Desc,
  Limit,
  Offset,

  // Control 
  SemiColon,
  Dot,
  Colon,
  Comma,
  EOF,
}


export interface Token {
  readonly value: string;
  readonly type: TokenType;
  readonly locationInSource: {
    readonly line: number;
    readonly column: number;
    readonly position: number;
    readonly filename?: string;
  }
}
