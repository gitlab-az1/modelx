import { Exception } from './@internals/errors';
import type { Dict, LooseAutocomplete } from './types';


export type WhereClause = {
  $equals: any;
} | {
  $diff: any;
} | {
  $in: any[];
} | {
  $notIn: any[];
} | {
  $contains: any;
} | {
  $notContains: any;
};

export type WhereClauseObject<T extends object> = {
  [K in keyof T]: WhereClause;
} & { $op?: 'AND' | 'OR' };

type NonFinalResult<T extends Dict<any>, V = any> = { readonly query: string; readonly values: V[]; readonly self: SqlBuiler<T> };


class SqlBuiler<T extends Dict<any>> {
  #query: string = '';
  #operation?: string;
  #prefix?: string;

  public constructor(tablesPrefix?: string) {
    this.#prefix = tablesPrefix;
  }

  /**
   * Retrieves the table prefix or `null` if none is set.
   */
  public get prefix(): string | null {
    return this.#prefix || null;
  }

  /**
   * Retrieves the final query string, ensuring it ends with a semicolon.
   */
  public get query(): string {
    return this.#query.endsWith(';') ? this.#query.trim() : `${this.#query.trim()};`;
  }

  /**
   * Begins a SELECT statement, defining which fields to retrieve.
   * 
   * @param fields - List of fields to select; supports '*' for all fields.
   * @returns `this` instance to allow chaining.
   * @throws Exception if an operation has already been defined.
   */
  public select<K extends keyof T>(...fields: LooseAutocomplete<K | '*'>[]): this {
    // eslint-disable-next-line no-extra-boolean-cast
    if(!!this.#operation) {
      throw new Exception(`SqlBuiler is already initialized with operation '${this.#operation.toUpperCase()}'`, 'ERR_UNSUPPORTED_OPERATION');
    }

    if(fields[0] === '*' && fields.length > 1) {
      throw new Exception('You must only type one parameter to \'select\' when using wildcard operator', 'ERR_INVALID_ARGUMENT');
    }

    this.#operation = 'select';
    this.#query = `SELECT ${fields[0] === '*' ? '*' : fields.map(item => String(item).trim()).join(', ')}`;

    return this;
  }

  /**
   * Begins an INSERT statement for the specified table and fields.
   * 
   * @param table - The table to insert into.
   * @param fields - Fields to insert values into.
   * @returns `this` instance to allow chaining.
   * @throws Exception if an operation has already been defined.
   */
  public insert<K extends keyof T>(table: string, ...fields: LooseAutocomplete<K>[]): this {
    // eslint-disable-next-line no-extra-boolean-cast
    if(!!this.#operation) {
      throw new Exception(`SqlBuiler is already initialized with operation '${this.#operation.toUpperCase()}'`, 'ERR_UNSUPPORTED_OPERATION');
    }

    this.#operation = 'insert';
    this.#query = `INSERT INTO ${this.#getPrefix()}${table} (${fields.map(item => String(item).trim()).join(', ')})`;
    return this;
  }

  /**
   * Begins an UPDATE statement for the specified table.
   * 
   * @param table - The table to update.
   * @returns `this` instance to allow chaining.
   * @throws Exception if an operation has already been defined.
   */
  public update(table: string): this {
    // eslint-disable-next-line no-extra-boolean-cast
    if(!!this.#operation) {
      throw new Exception(`SqlBuiler is already initialized with operation '${this.#operation.toUpperCase()}'`, 'ERR_UNSUPPORTED_OPERATION');
    }

    this.#operation = 'update';
    this.#query = `UPDATE ${this.#getPrefix()}${table}`;

    return this;
  }

  /**
   * Begins a DELETE statement.
   * 
   * @returns `this` instance to allow chaining.
   * @throws Exception if an operation has already been defined.
   */
  public delete(): this {
    // eslint-disable-next-line no-extra-boolean-cast
    if(!!this.#operation) {
      throw new Exception(`SqlBuiler is already initialized with operation '${this.#operation.toUpperCase()}'`, 'ERR_UNSUPPORTED_OPERATION');
    }

    this.#operation = 'delete';
    this.#query = 'DELETE';

    return this;
  }

  /**
   * Adds a FROM clause to the query, specifying the target table.
   * 
   * @param table - The table to select from or delete from.
   * @returns `this` instance to allow chaining.
   * @throws Exception if no operation has been started.
   */
  public from(table: string): this {
    if(!this.#operation) {
      throw new Exception('Cannot apply \'FROM\' clause when the query is not started', 'ERR_UNSUPPORTED_OPERATION');
    }

    this.#query += ` FROM ${this.#getPrefix()}${table}`;
    return this;
  }

  /**
   * Adds values for an INSERT statement, binding them to positional parameters.
   * 
   * @param values - Values to insert into the table.
   * @returns `NonFinalResult` with the query and values.
   * @throws Exception if the current operation is not INSERT.
   */
  public values<V = any>(...values: V[]): NonFinalResult<T, V> {
    if(this.#operation !== 'insert') {
      throw new Exception('VALUES can only be used with INSERT operation', 'ERR_UNSUPPORTED_OPERATION');
    }

    this.#query += ' VALUES (';

    for(let i = 0; i < values.length; i++) {
      this.#query += `$${i + 1}${i < values.length - 1 ? ', ' : ''}`;
    }

    this.#query += ');';
    
    return Object.freeze({
      query: this.#query.endsWith(';') ? this.#query.trim() : `${this.#query.trim()};`,
      self: this,
      values,
    });
  }

  /**
   * Adds a WHERE clause to the query for filtering results.
   * 
   * @param clause - A string condition or structured object defining field conditions.
   * @returns `this` instance to allow chaining.
   * @throws Exception if the operation is not SELECT, DELETE, or UPDATE.
   */
  public where<T extends object>(clause: string | WhereClauseObject<T>): this {
    if(!this.#operation || !['select', 'delete', 'update'].includes(this.#operation)) {
      throw new Exception('WHERE clause can only be used with SELECT, DELETE, or UPDATE operations', 'ERR_UNSUPPORTED_OPERATION');
    }

    this.#query += ' WHERE ';

    if(typeof clause === 'string') {
      this.#query += clause;
    } else {
      const clauses = [] as string[];
      const entries = Object.entries(clause);

      for(let i = 0; i < entries.length; i++) {
        if('$in' in (entries[i][1] as any) || '$notIn' in (entries[i][1] as any)) {
          clauses.push(`${(entries[i][1] as any).$notIn ? 'NOT ' : ''}ANY($${i + 1}) = ${entries[i][0]}`);
        } else if('$contains' in (entries[i][1] as any) || '$notContains' in (entries[i][1] as any)) {
          clauses.push(`${(entries[i][1] as any).$notContains ? 'NOT ' : ''}ANY(${entries[i][0]}) = $${i + 1}`);
        } else {
          clauses.push(`${(entries[i][1] as any).$diff ? 'NOT ' : ''}${entries[i][0]} = $${i + 1}`);
        }
      }

      this.#query += clauses.join(clause.$op || 'OR');
    }

    return this;
  }

  /**
   * Adds a SET clause to the query for UPDATE statements, defining the fields to update.
   * 
   * @param fields - An object where keys are field names and values are the new values.
   * @returns `NonFinalResult` with the query and values.
   * @throws Exception if the current operation is not UPDATE.
   */
  public set<V = any>(fields: { [K in keyof T]: V }): NonFinalResult<T, V> {
    if(this.#operation !== 'update') {
      throw new Exception('SET can only be used with UPDATE operation', 'ERR_UNSUPPORTED_OPERATION');
    }

    const entries = Object.entries(fields);
    const fieldsBinding = [] as string[];

    for(let i = 0; i < entries.length; i++) {
      fieldsBinding.push(`${entries[i][0]} = $${i + 1}`);
    }

    this.#query += ` SET ${fieldsBinding.join(', ')}`;
    
    return Object.freeze({
      query: this.#query.endsWith(';') ? this.#query.trim() : `${this.#query.trim()};`,
      values: entries.map(item => item[1]),
      self: this,
    });
  }

  /**
   * Adds a Common Table Expression (CTE) to the query. Supports recursive queries.
   * 
   * @param alias - The alias name for the CTE.
   * @param query - The SQL query to use as the CTE definition.
   * @param recursive - Flag for using WITH RECURSIVE.
   */
  public with<TQuery extends object>(alias: string, query: string | SqlBuiler<TQuery>, recursive: boolean = false): this {
    if(this.#operation) {
      throw new Exception('Cannot apply CTE when a main query operation is already defined', 'ERR_UNSUPPORTED_OPERATION');
    }

    const keyword = recursive ? 'WITH RECURSIVE' : 'WITH';
    this.#query = `${keyword} ${alias} AS (${query.toString()}) ${this.#query}`;

    return this;
  }

  /**
   * Adds a JOIN clause to the query.
   * 
   * @param type - The type of join (INNER, LEFT, RIGHT, FULL).
   * @param table - The table to join with.
   * @param alias - Alias for the joined table.
   * @param condition - Join condition, typically on a foreign key relation.
   */
  public join(type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL', table: string, alias: string, condition: string): this {
    if(!this.#operation || this.#operation !== 'select') {
      throw new Exception('JOIN can only be used with SELECT operations', 'ERR_UNSUPPORTED_OPERATION');
    }

    this.#query += ` ${type} JOIN ${this.#getPrefix()}${table} AS ${alias} ON ${condition}`;
    return this;
  }

  /**
   * Adds an alias to a field in the SELECT clause.
   * 
   * @param field - The field to alias.
   * @param alias - The alias name for the field.
   */
  public as(field: keyof T | string, alias: string): this {
    if(!this.#operation || this.#operation !== 'select') {
      throw new Exception('Alias can only be used with SELECT operations', 'ERR_UNSUPPORTED_OPERATION');
    }

    // Replace the last SELECT clause field with an alias
    const regex = new RegExp(`\\b${String(field)}\\b`, 'g');
    this.#query = this.#query.replace(regex, `${String(field)} AS ${alias}`);

    return this;
  }

  /**
   * Adds a UNION or UNION ALL clause to combine multiple queries.
   * 
   * @param all - If true, uses UNION ALL, otherwise UNION.
   * @param builder - Another SqlBuiler instance to join with UNION.
   */
  public union(all: boolean = false, builder: SqlBuiler<T>): this {
    if(!this.#operation || this.#operation !== 'select') {
      throw new Exception('UNION can only be used with SELECT operations', 'ERR_UNSUPPORTED_OPERATION');
    }

    this.#query += ` ${all ? 'UNION ALL' : 'UNION'} ${builder.toString()}`;
    return this;
  }

  /**
   * Adds an ORDER BY clause to the query.
   * 
   * @param fields - Fields and their order (ASC/DESC).
   */
  public orderBy(fields: { [K in keyof T]?: 'ASC' | 'DESC' }): this {
    if(!this.#operation || this.#operation !== 'select') {
      throw new Exception('ORDER BY can only be used with SELECT operations', 'ERR_UNSUPPORTED_OPERATION');
    }

    const orders = Object.entries(fields)
      .map(([field, order]) => `${field} ${order}`)
      .join(', ');

    this.#query += ` ORDER BY ${orders}`;
    return this;
  }

  /**
   * Adds a GROUP BY clause to the query.
   * 
   * @param fields - Fields to group by.
   */
  public groupBy(...fields: (keyof T | string)[]): this {
    if(!this.#operation || this.#operation !== 'select') {
      throw new Exception('GROUP BY can only be used with SELECT operations', 'ERR_UNSUPPORTED_OPERATION');
    }

    this.#query += ` GROUP BY ${fields.join(', ')}`;
    return this;
  }

  /**
   * Adds a HAVING clause to the query.
   * 
   * @param condition - The HAVING condition.
   */
  public having(condition: string): this {
    if(!this.#operation || this.#operation !== 'select') {
      throw new Exception('HAVING can only be used with SELECT operations', 'ERR_UNSUPPORTED_OPERATION');
    }

    this.#query += ` HAVING ${condition}`;
    return this;
  }

  /**
   * Adds a LIMIT clause to the query for SELECT operations.
   * 
   * @param count - The maximum number of rows to retrieve.
   * @returns `this` instance to allow chaining.
   * @throws Exception if the operation is not SELECT.
   */
  public limit(count: number): this {
    if(!['select'].includes(this.#operation!)) {
      throw new Exception('LIMIT can only be used with SELECT operations', 'ERR_UNSUPPORTED_OPERATION');
    }

    this.#query += ` LIMIT ${count}`;
    return this;
  }

  /**
   * Adds an OFFSET clause to the query for paginated SELECT operations.
   * 
   * @param count - The number of rows to skip before starting to return rows.
   * @returns `this` instance to allow chaining.
   * @throws Exception if the operation is not SELECT.
   */
  public offset(count: number): this {
    if(!['select'].includes(this.#operation!)) {
      throw new Exception('OFFSET can only be used with SELECT operations', 'ERR_UNSUPPORTED_OPERATION');
    }

    this.#query += ` OFFSET ${count}`;
    return this;
  }

  /**
   * Returns the final query as a string.
   * 
   * @returns The complete SQL query string.
   */
  public toString(): string {
    return this.#query.endsWith(';') ? this.#query.trim() : `${this.#query.trim()};`;
  }

  /**
   * Returns the final query as a string.
   * 
   * @returns The complete SQL query string.
   */
  public valueOf(): string {
    return this.#query.endsWith(';') ? this.#query.trim() : `${this.#query.trim()};`;
  }

  #getPrefix(): string {
    if(!this.#prefix) return '';
    if(this.#prefix[this.#prefix.length - 1] === '_') return this.#prefix;
    return `${this.#prefix}_`;
  }
}


export const sql = <T extends object>(tablePrefix?: string) => new SqlBuiler<T>(tablePrefix);

export default sql;
