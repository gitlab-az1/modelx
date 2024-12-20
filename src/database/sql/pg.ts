import { asyncRetry } from 'typesdk/async';
import { type PoolConfig, type PoolClient, Pool, type FieldDef } from 'pg';

import { Pair } from '../../pair';
import { Exception } from '../../@internals/errors';
import type { LooseAutocomplete } from '../../types';
import { assertNumber, assertString } from '../../@internals/util';


enum QUERY_OPERATION {
  SELECT,
  UPDATE,
  DELETE,
  INSERT,
}

type _Result<R> = {
  rows: R[];
  command: string;
  rowCount: number | null;
  oid: number;
  fields: FieldDef[];
}

type BuilderState = {
  operation: QUERY_OPERATION | null;
  query: string;
  datname: string;
  table: string;
  bindValues: any[];
  missingComponents: string[];
  _conn: PoolConfig;
  _cache: {
    pool: Pool | null;
    maxConnections: number | null;
    openedConnections: number | null;
    reservedConnections: number | null;
    openedConnectionsLastUpdate: number | null;
  };
};

export type ConnectionProps = {
  user: string;
  password: string;
  database: string;
  host: string;
  port: number;
}

class PostgresBuilder<T> {
  readonly #state: BuilderState;

  public constructor(
    _datname: string,
    _tablename: string,
    _cnp: string | ConnectionProps, 
    _ssl: boolean = false // eslint-disable-line comma-dangle
  ) {
    assertString(_datname);
    assertString(_tablename);

    this.#state = {
      datname: _datname,
      table: _tablename,
      operation: null,
      query: '',
      missingComponents: [],
      bindValues: [],
      _conn: {
        connectionTimeoutMillis: 2000,
        idleTimeoutMillis: 30000,
        max: 1,
        ssl: {
          rejectUnauthorized: false,
        },
        allowExitOnIdle: true,
      },
      _cache: {
        pool: null,
        maxConnections: 1,
        reservedConnections: null,
        openedConnections: null,
        openedConnectionsLastUpdate: null,
      },
    };

    if(_ssl !== true) {
      delete this.#state._conn.ssl;
    }

    if(typeof _cnp === 'string') {
      this.#state._conn.connectionString = _cnp;
    } else {
      this.#state._conn = {
        ...this.#state._conn,
        ..._cnp,
        database: _datname,
      };
    }
  }

  public withRecursive(raw: string): this {
    if(this.#state.operation) {
      throw new Exception('Cannot declare a RECURSIVE statement when the query is already started', 'ERR_UNSUPPORTED_OPERATION');
    }

    this.#state.query = `WITH RECURSIVE (\n\t${raw}\n)\n`;
    return this;
  }

  public select(...fields: readonly LooseAutocomplete<keyof T>[]): this {
    if(this.#state.operation) {
      throw new Exception(`Cannot create a SELECT query because this builder is already initialized with ${QUERY_OPERATION[this.#state.operation]}`, 'ERR_UNSUPPORTED_OPERATION');
    }

    const returnedFields = fields.length > 0 ? fields.join(',') : '*';

    this.#state.operation = QUERY_OPERATION.SELECT;
    this.#state.query = `SELECT ${returnedFields} FROM ${this.#state.table}`;

    return this;
  }

  public insert(entries: { [K in keyof T]: T[K] }, options?: { withReturn?: boolean | LooseAutocomplete<keyof T>[] }): this {
    if(this.#state.operation) {
      throw new Exception(`Cannot create a SELECT query because this builder is already initialized with ${QUERY_OPERATION[this.#state.operation]}`, 'ERR_UNSUPPORTED_OPERATION');
    }

    this.#state.query = `INSERT INTO ${this.#state.table} (${Object.keys(entries).join(', ')}) VALUES (${Object.keys(entries).map(item => item + 1).map(item => `$${item}`).join(', ')})`;
    this.#state.bindValues.push(...Object.values(entries));

    if(options?.withReturn === true) {
      this.#state.missingComponents.push('RETURNING *');
    } else if(Array.isArray(options?.withReturn) && options.withReturn.length > 0) {
      this.#state.missingComponents.push(`RETURNING ${options.withReturn.join(', ')}`);
    }

    return this;
  }

  public insertAndInspect(entries: { [K in keyof T]: T[K] }, options?: { withReturn?: boolean | LooseAutocomplete<keyof T>[] }): Pair<string, T[keyof T][]> {
    if(this.#state.operation) {
      throw new Exception(`Cannot create a SELECT query because this builder is already initialized with ${QUERY_OPERATION[this.#state.operation]}`, 'ERR_UNSUPPORTED_OPERATION');
    }

    this.#state.query = `INSERT INTO ${this.#state.table} (${Object.keys(entries).join(', ')}) VALUES (${Object.keys(entries).map(item => item + 1).map(item => `$${item}`).join(', ')})`;
    this.#state.bindValues.push(...Object.values(entries));

    if(options?.withReturn === true) {
      this.#state.missingComponents.push('RETURNING *');
    } else if(Array.isArray(options?.withReturn) && options.withReturn.length > 0) {
      this.#state.missingComponents.push(`RETURNING ${options.withReturn.join(', ')}`);
    }

    this.#state.query = `${this.#state.query.trim()} ${this.#state.missingComponents.join(' ')}`.trim();
    return new Pair(this.#state.query.slice(0), Object.values(entries));
  }

  public update(updates: { [K in keyof T]?: T[K] }, options?: { 
    withReturn?: boolean | LooseAutocomplete<keyof T>[]; 
    includeTimestamps?: boolean;
  }): this {
    if(this.#state.operation) {
      throw new Exception(`Cannot create an UPDATE query because this builder is already initialized with ${QUERY_OPERATION[this.#state.operation]}`, 'ERR_UNSUPPORTED_OPERATION');
    }
  
    const updateEntries = Object.entries(updates);

    if(updateEntries.length === 0) {
      throw new Exception('No fields provided for update', 'ERR_INVALID_ARGUMENT');
    }
  
    const queryParts = updateEntries.map(([key], index) => `${key} = $${index + 1}`);
    this.#state.bindValues = updateEntries.map(([, value]) => value);

    if(options?.includeTimestamps) {
      queryParts.push(`updated_at = $${updateEntries.length + 2}`);
      this.#state.bindValues.push(new Date().toISOString());
    }

    if(options?.withReturn === true) {
      this.#state.missingComponents.push('RETURNING *');
    } else if(Array.isArray(options?.withReturn) && options.withReturn.length > 0) {
      this.#state.missingComponents.push(`RETURNING ${options.withReturn.join(', ')}`);
    }

    this.#state.query = `UPDATE ${this.#state.table} SET ${queryParts.join(', ')}`;
    this.#state.query = `${this.#state.query.trim()} ${this.#state.missingComponents.join(' ')}`.trim();

    return this;
  }

  public updateAndInspect(updates: { [K in keyof T]?: T[K] }, options?: { 
    withReturn?: boolean | LooseAutocomplete<keyof T>[]; 
    includeTimestamps?: boolean;
  }): Pair<string, T[keyof T][]> {
    if(this.#state.operation) {
      throw new Exception(`Cannot create an UPDATE query because this builder is already initialized with ${QUERY_OPERATION[this.#state.operation]}`, 'ERR_UNSUPPORTED_OPERATION');
    }
  
    const updateEntries = Object.entries(updates);

    if(updateEntries.length === 0) {
      throw new Exception('No fields provided for update', 'ERR_INVALID_ARGUMENT');
    }
  
    const queryParts = updateEntries.map(([key], index) => `${key} = $${index + 1}`);
    this.#state.bindValues = updateEntries.map(([, value]) => value);
  
    if(options?.includeTimestamps) {
      queryParts.push(`updated_at = $${updateEntries.length + 2}`);
      this.#state.bindValues.push(new Date().toISOString());
    }
  
    this.#state.query = `UPDATE ${this.#state.table} SET ${queryParts.join(', ')}`;
  
    if(options?.withReturn === true) {
      this.#state.missingComponents.push('RETURNING *');
    } else if (Array.isArray(options?.withReturn) && options.withReturn.length > 0) {
      this.#state.missingComponents.push(`RETURNING ${options.withReturn.join(', ')}`);
    }
  
    this.#state.query = `${this.#state.query.trim()} ${this.#state.missingComponents.join(' ')}`.trim();
    return new Pair(this.#state.query.slice(0), this.#state.bindValues.slice(0));
  }

  public join(type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'OUTER' | 'CROSS', t: string, ...r: string[]): this {
    this.#ensureQueryStarted();

    if(r.length === 0) {
      throw new Exception('You must enter params for a join statement', 'ERR_INVALID_ARGUMENT');
    }

    if(r.length % 2 !== 0) {
      throw new Exception('You must enter a pair of table columns for a simple join statement', 'ERR_INVALID_ARGUMENT');
    }

    if(
      !['INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'CROSS'].includes(type)
    ) {
      type = 'INNER';
    }

    const onConditions: string[] = [];

    for(let i = 0; i < r.length; i += 2) {
      onConditions.push(`${r[i]} = ${r[i + 1]}`);
    }

    this.#state.query += ` ${type} JOIN ${t} ON ${onConditions.join(' AND ')}`;
    return this;
  }

  public innerJoin(t: string, ...r: string[]): this {
    return this.join('INNER', t, ...r);
  }

  public leftJoin(t: string, ...r: string[]): this {
    return this.join('LEFT', t, ...r);
  }

  public rightJoin(t: string, ...r: string[]): this {
    return this.join('RIGHT', t, ...r);
  }

  public fullJoin(t: string, ...r: string[]): this {
    return this.join('FULL', t, ...r);
  }

  public whereRaw(raw: string): this {
    this.#ensureQueryStarted();

    this.#state.query += ` WHERE ${raw}`;
    return this;
  }

  public notWhereRaw(raw: string): this {
    this.#ensureQueryStarted();

    this.#state.query += ` WHERE NOT ${raw}`;
    return this;
  }

  public andWhereRaw(raw: string): this {
    this.#ensureQueryStarted();

    this.#state.query += ` AND ${raw}`;
    return this;
  }

  public andNotWhereRaw(raw: string): this {
    this.#ensureQueryStarted();

    this.#state.query += ` AND NOT ${raw}`;
    return this;
  }

  public orWhereRaw(raw: string): this {
    this.#ensureQueryStarted();

    this.#state.query += ` OR ${raw}`;
    return this;
  }

  public orNotWhereRaw(raw: string): this {
    this.#ensureQueryStarted();

    this.#state.query += ` OR NOT ${raw}`;
    return this;
  }

  public where(field: LooseAutocomplete<keyof T>, value: any): this {
    assertString(field);
    this.#ensureQueryStarted();

    this.#state.bindValues.push(value);
    this.#state.query += ` WHERE ${field} = $${this.#state.bindValues.length}`;

    return this;
  }

  public whereNot(field: LooseAutocomplete<keyof T>, value: any): this {
    assertString(field);
    this.#ensureQueryStarted();

    this.#state.bindValues.push(value);
    this.#state.query += ` WHERE NOT ${field} = $${this.#state.bindValues.length}`;

    return this;
  }

  public andWhere(field: LooseAutocomplete<keyof T>, value: any): this {
    assertString(field);
    this.#ensureQueryStarted();
  
    this.#state.bindValues.push(value);
    this.#state.query += ` AND ${field} = $${this.#state.bindValues.length}`;
    return this;
  }
  
  public andNotWhere(field: LooseAutocomplete<keyof T>, value: any): this {
    assertString(field);
    this.#ensureQueryStarted();
  
    this.#state.bindValues.push(value);
    this.#state.query += ` AND NOT ${field} = $${this.#state.bindValues.length}`;
    return this;
  }
  
  public orWhere(field: LooseAutocomplete<keyof T>, value: any): this {
    assertString(field);
    this.#ensureQueryStarted();
  
    this.#state.bindValues.push(value);
    this.#state.query += ` OR ${field} = $${this.#state.bindValues.length}`;
    return this;
  }
  
  public orNotWhere(field: LooseAutocomplete<keyof T>, value: any): this {
    assertString(field);
    this.#ensureQueryStarted();
  
    this.#state.bindValues.push(value);
    this.#state.query += ` OR NOT ${field} = $${this.#state.bindValues.length}`;
    return this;
  }

  public whereBetween(field: LooseAutocomplete<keyof T>, range: [any, any]): this {
    assertString(field);
    this.#ensureQueryStarted();
  
    const [start, end] = range;
    this.#state.bindValues.push(start, end);
    this.#state.query += ` WHERE ${field} BETWEEN $${this.#state.bindValues.length - 1} AND $${this.#state.bindValues.length}`;
    return this;
  }
  
  public whereNotBetween(field: LooseAutocomplete<keyof T>, range: [any, any]): this {
    assertString(field);
    this.#ensureQueryStarted();
  
    const [start, end] = range;
    this.#state.bindValues.push(start, end);
    this.#state.query += ` WHERE ${field} NOT BETWEEN $${this.#state.bindValues.length - 1} AND $${this.#state.bindValues.length}`;
    return this;
  }
  
  public andWhereBetween(field: LooseAutocomplete<keyof T>, range: [any, any]): this {
    assertString(field);
    this.#ensureQueryStarted();
  
    const [start, end] = range;
    this.#state.bindValues.push(start, end);
    this.#state.query += ` AND ${field} BETWEEN $${this.#state.bindValues.length - 1} AND $${this.#state.bindValues.length}`;
    return this;
  }
  
  public orWhereBetween(field: LooseAutocomplete<keyof T>, range: [any, any]): this {
    assertString(field);
    this.#ensureQueryStarted();
  
    const [start, end] = range;
    this.#state.bindValues.push(start, end);
    this.#state.query += ` OR ${field} BETWEEN $${this.#state.bindValues.length - 1} AND $${this.#state.bindValues.length}`;
    return this;
  }
  
  public whereLike(field: LooseAutocomplete<keyof T>, pattern: string): this {
    assertString(field);
    this.#ensureQueryStarted();
  
    this.#state.bindValues.push(pattern);
    this.#state.query += ` WHERE ${field} LIKE $${this.#state.bindValues.length}`;
    return this;
  }
  
  public whereILike(field: LooseAutocomplete<keyof T>, pattern: string): this {
    assertString(field);
    this.#ensureQueryStarted();
  
    this.#state.bindValues.push(pattern);
    this.#state.query += ` WHERE ${field} ILIKE $${this.#state.bindValues.length}`;
    return this;
  }
  
  public andWhereLike(field: LooseAutocomplete<keyof T>, pattern: string): this {
    assertString(field);
    this.#ensureQueryStarted();
  
    this.#state.bindValues.push(pattern);
    this.#state.query += ` AND ${field} LIKE $${this.#state.bindValues.length}`;
    return this;
  }
  
  public orWhereLike(field: LooseAutocomplete<keyof T>, pattern: string): this {
    assertString(field);
    this.#ensureQueryStarted();
  
    this.#state.bindValues.push(pattern);
    this.#state.query += ` OR ${field} LIKE $${this.#state.bindValues.length}`;
    return this;
  }
  
  public whereDate(field: LooseAutocomplete<keyof T>, operator: string, date: Date | string): this {
    assertString(field);
    this.#ensureQueryStarted();
  
    this.#state.bindValues.push(date);
    this.#state.query += ` WHERE ${field} ${operator} $${this.#state.bindValues.length}`;
    return this;
  }
  
  public andWhereDate(field: LooseAutocomplete<keyof T>, operator: string, date: Date | string): this {
    assertString(field);
    this.#ensureQueryStarted();
  
    this.#state.bindValues.push(date);
    this.#state.query += ` AND ${field} ${operator} $${this.#state.bindValues.length}`;
    return this;
  }
  
  public orWhereDate(field: LooseAutocomplete<keyof T>, operator: string, date: Date | string): this {
    assertString(field);
    this.#ensureQueryStarted();
  
    this.#state.bindValues.push(date);
    this.#state.query += ` OR ${field} ${operator} $${this.#state.bindValues.length}`;
    return this;
  }
  
  public whereArrayContains(field: LooseAutocomplete<keyof T>, value: any): this {
    assertString(field);
    this.#ensureQueryStarted();
  
    this.#state.bindValues.push(value);
    this.#state.query += ` WHERE ${field} @> $${this.#state.bindValues.length}`;
    return this;
  }
  
  public whereArrayContained(field: LooseAutocomplete<keyof T>, value: any[]): this {
    assertString(field);
    this.#ensureQueryStarted();
  
    this.#state.bindValues.push(value);
    this.#state.query += ` WHERE ${field} <@ $${this.#state.bindValues.length}`;
    return this;
  }
  
  public whereJsonb(field: LooseAutocomplete<keyof T>, path: string[], operator: string, value: any): this {
    assertString(field);
    this.#ensureQueryStarted();
  
    this.#state.bindValues.push(value);
    const jsonPath = path.map(p => `'${p}'`).join(',');
    this.#state.query += ` WHERE ${field} #> ARRAY[${jsonPath}]::text[] ${operator} $${this.#state.bindValues.length}`;
    return this;
  }
  
  public andWhereJsonb(field: LooseAutocomplete<keyof T>, path: string[], operator: string, value: any): this {
    assertString(field);
    this.#ensureQueryStarted();
  
    this.#state.bindValues.push(value);
    const jsonPath = path.map(p => `'${p}'`).join(',');
    this.#state.query += ` AND ${field} #> ARRAY[${jsonPath}]::text[] ${operator} $${this.#state.bindValues.length}`;
    return this;
  }
  
  public orWhereJsonb(field: LooseAutocomplete<keyof T>, path: string[], operator: string, value: any): this {
    assertString(field);
    this.#ensureQueryStarted();
  
    this.#state.bindValues.push(value);
    const jsonPath = path.map(p => `'${p}'`).join(',');
    this.#state.query += ` OR ${field} #> ARRAY[${jsonPath}]::text[] ${operator} $${this.#state.bindValues.length}`;
    return this;
  }

  public whereIn(field: LooseAutocomplete<keyof T>, values: any[]): this {
    assertString(field);
    this.#ensureQueryStarted();
  
    const placeholders = values.map((_, i) => `$${this.#state.bindValues.length + i + 1}`).join(', ');
    this.#state.bindValues.push(...values);
    this.#state.query += ` WHERE ${field} IN (${placeholders})`;
    return this;
  }
  
  public whereNotIn(field: LooseAutocomplete<keyof T>, values: any[]): this {
    assertString(field);
    this.#ensureQueryStarted();
  
    const placeholders = values.map((_, i) => `$${this.#state.bindValues.length + i + 1}`).join(', ');
    this.#state.bindValues.push(...values);
    this.#state.query += ` WHERE ${field} NOT IN (${placeholders})`;
    return this;
  }
  
  public andWhereIn(field: LooseAutocomplete<keyof T>, values: any[]): this {
    assertString(field);
    this.#ensureQueryStarted();
  
    const placeholders = values.map((_, i) => `$${this.#state.bindValues.length + i + 1}`).join(', ');
    this.#state.bindValues.push(...values);
    this.#state.query += ` AND ${field} IN (${placeholders})`;
    return this;
  }
  
  public andNotWhereIn(field: LooseAutocomplete<keyof T>, values: any[]): this {
    assertString(field);
    this.#ensureQueryStarted();
  
    const placeholders = values.map((_, i) => `$${this.#state.bindValues.length + i + 1}`).join(', ');
    this.#state.bindValues.push(...values);
    this.#state.query += ` AND NOT ${field} IN (${placeholders})`;
    return this;
  }
  
  public orWhereIn(field: LooseAutocomplete<keyof T>, values: any[]): this {
    assertString(field);
    this.#ensureQueryStarted();
  
    const placeholders = values.map((_, i) => `$${this.#state.bindValues.length + i + 1}`).join(', ');
    this.#state.bindValues.push(...values);
    this.#state.query += ` OR ${field} IN (${placeholders})`;
    return this;
  }
  
  public orNotWhereIn(field: LooseAutocomplete<keyof T>, values: any[]): this {
    assertString(field);
    this.#ensureQueryStarted();
  
    const placeholders = values.map((_, i) => `$${this.#state.bindValues.length + i + 1}`).join(', ');
    this.#state.bindValues.push(...values);
    this.#state.query += ` OR NOT ${field} IN (${placeholders})`;
    return this;
  }

  public groupBy(...entries: LooseAutocomplete<keyof T>[]): this {
    this.#ensureQueryStarted();

    for(let i = 0; i < entries.length; i++) {
      assertString(entries[i]);
    }

    this.#state.query += ` GROUP BY ${entries.join(', ')}`;
    return this;
  }

  public orderBy(...entries: { field: LooseAutocomplete<keyof T>; order: 'ASC' | 'DESC' }[]): this {
    if(entries.length === 0) {
      throw new Exception('You must enter a field to order the query results', 'ERR_INVALID_ARGUMENT');
    }

    this.#ensureQueryStarted();
    const fields = [] as string[];

    for(let i = 0; i < entries.length; i++) {
      assertString(entries[i].field);

      if(!['ASC', 'DESC'].includes(entries[i].order)) {
        entries[i].order = 'ASC';
      }

      fields.push(`${entries[i].field as string} ${entries[i].order}`);
    }

    this.#state.query += ` ORDER BY ${fields.join(', ')}`;
    return this;
  }

  public limit(l: number): this {
    this.#ensureQueryStarted();
    assertNumber(l);

    this.#state.query += ` LIMIT ${l}`;
    return this;
  }

  public offset(o: number): this {
    this.#ensureQueryStarted();
    assertNumber(o);

    this.#state.query += ` OFFSET ${o}`;
    return this;
  }

  public returnInsertValues(): this {
    if(this.#state.operation !== QUERY_OPERATION.INSERT) return this;
    
    this.#state.missingComponents.push('RETURNING *');
    return this;
  }

  public raw(raw: string): this {
    this.#state.query += raw;
    return this;
  }

  public toString(): string {
    this.#state.query = `${this.#state.query.trim()} ${this.#state.missingComponents.join(' ')}`.trim();
    return this.#state.query;
  }

  public async execute<TResult = T>(): Promise<_Result<TResult>> {
    this.#ensureQueryStarted();

    if(!(await this.#isConnected())) {
      throw new Exception('Could not connect to this postgres database', 'ERR_UNSUPPORTED_OPERATION');
    }

    this.#state.query = `${this.#state.query.trim()} ${this.#state.missingComponents.join(' ')}`.trim();
    return await this.#query(this.#state.query, { values: this.#state.bindValues });
  }

  #accquireClient(): Promise<PoolClient> {
    return asyncRetry<PoolClient>(async () => {
      if(!this.#state._cache.pool) {
        this.#state._cache.pool = new Pool(this.#state._conn);
      }

      return await this.#state._cache.pool.connect();
    }, {
      retries: 2,
      minTimeout: 150,
      maxTimeout: 5000,
      factor: 2,
    });
  }

  async #checkForTooManyConnections(client: PoolClient): Promise<boolean> {
    const currentTime = new Date().getTime();
    const openedConnectionsMaxAge = 5000;
    const maxConnectionsTolerance = 0.8;

    const getOpenedConnections = async () => {
      const openConnectionsResult = await client.query({
        text: 'SELECT numbackends as opened_connections FROM pg_stat_database where datname = $1',
        values: [this.#state.datname],
      });
      return openConnectionsResult.rows[0].opened_connections;
    };

    if(this.#state._cache.maxConnections === null || this.#state._cache.reservedConnections === null) {
      const [maxConnections, reservedConnections] = await getConnectionLimits();
      this.#state._cache.maxConnections = maxConnections;
      this.#state._cache.reservedConnections = reservedConnections;
    }

    if(this.#state._cache.openedConnections === null || currentTime - this.#state._cache.openedConnectionsLastUpdate! > openedConnectionsMaxAge) {
      const openedConnections = await getOpenedConnections();
      this.#state._cache.openedConnections = openedConnections;
      this.#state._cache.openedConnectionsLastUpdate = currentTime;
    }

    if(this.#state._cache.openedConnections! > (this.#state._cache.maxConnections! - this.#state._cache.reservedConnections!) * maxConnectionsTolerance) return true;

    return false;

    async function getConnectionLimits() {
      const [maxConnectionsResult, reservedConnectionResult] = await client.query(
        'SHOW max_connections; SHOW superuser_reserved_connections;',
      ) as any;
        
      return [
        maxConnectionsResult.rows[0].max_connections,
        reservedConnectionResult.rows[0].superuser_reserved_connections,
      ] as [number, number];
    }
  }

  async #query<T = Record<string, unknown>>(text: string, options?: { values?: any[]; transactionClient?: PoolClient }): Promise<_Result<T>> {
    let client: PoolClient | null = null;

    try {
      client = options?.transactionClient || await this.#accquireClient();
      return await client.query({
        text,
        values: options?.values,
      }) as any;
    } finally {
      if(client && !options?.transactionClient) {
        const tooManyConnections = await this.#checkForTooManyConnections(client);
        client.release();

        if(tooManyConnections) {
          await this.#state._cache.pool?.end();
          this.#state._cache.pool = null;
        }
      }
    }
  }

  async #isConnected(): Promise<boolean> {
    try {
      await this.#query('SELECT numbackends FROM pg_stat_database where datname = $1', {
        values: [this.#state.datname],
      });

      return true;
    } catch (err: any) {
      console.error(err); // MAYBE REMOVE IT?
      return false;
    }
  }

  #ensureQueryStarted(): void {
    if(this.#state.operation == null || !this.#state.query) {
      throw new Exception(
        'No query operation has been started. Use methods like `select` or `update` first.',
        'ERR_UNSUPPORTED_OPERATION' );
    }
  }
}


export function createClient<T>(connection: string | ConnectionProps, options?: { ssl?: boolean }): <K extends keyof T>(table: K | Omit<string, K>) => PostgresBuilder<T[K]> {
  let datname: string;

  if(typeof connection === 'string') {
    datname = new URL(connection).pathname;
  } else {
    datname = connection.database;
  }

  return (table: any) => {
    return new PostgresBuilder(datname, table as string, connection, options?.ssl);
  };
}
