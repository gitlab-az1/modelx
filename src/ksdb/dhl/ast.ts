export type NodeType = 
  | 'Program'
  | 'IntegerLiteral'
  | 'DecimalLiteral'
  | 'BinaryExpression'
  | 'StringLiteral'
  | 'Identifier'
  | 'Symbol'
  | 'CallExpression'
  | 'UnaryExpression'
  | 'NullLiteral'
  | 'AssignmentExpression'
  | 'CastExpression';


export interface Statement {
  kind: NodeType;
}
  
export interface Program extends Statement {
  kind: 'Program';
  body: readonly Statement[];
}
  
export interface Expression extends Statement {}


export interface BinaryExpression extends Expression {
  kind: 'BinaryExpression';
  operator: string;
  left: Expression;
  right: Expression;
}

export interface Identifier extends Expression {
  kind: 'Identifier';
  symbol: string;
}

export interface StringLiteral extends Expression {
  kind: 'StringLiteral';
  value: string;
}

export interface IntegerLiteral extends Expression {
  kind: 'IntegerLiteral';
  value: number;
}

export interface DecimalLiteral extends Expression {
  kind: 'DecimalLiteral';
  value: number;
}

export interface Symbol extends Expression {
  kind: 'Symbol';
  symbol: string;
}

export interface CallExpression extends Expression {
  kind: 'CallExpression';
  arguments: readonly Expression[];
  caller: Expression;
}

export interface AssignmentExpression extends Expression {
  kind: 'AssignmentExpression';
  target: Expression;
  value: Expression;
}

export interface NullLiteral extends Expression {
  kind: 'NullLiteral';
  value: null;
}

export interface UnaryExpression extends Expression {
  kind: 'UnaryExpression';
  operator: string;
  expression: Expression;
}

export interface CastExpression extends Expression {
  kind: 'CastExpression';
  expression: Expression;  // The value being casted (e.g., $1)
  type: string;      // The type name (e.g., 'TEXT', 'JSON')
  isArray: boolean;  // Whether the type is an array (e.g., TEXT[])
}
