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

    this.#state.query = `INSERT INTO ${this.#state.table} (${Object.keys(entries).join(', ')}) VALUES (${Object.keys(entries).map((_, index) => index + 1).map(item => `$${item}`).join(', ')})`;
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

    this.#state.query = `INSERT INTO ${this.#state.table} (${Object.keys(entries).join(', ')}) VALUES (${Object.keys(entries).map((_, index) => index + 1).map(item => `$${item}`).join(', ')})`;
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

    this.#state.operation = QUERY_OPERATION.UPDATE;
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
  
    this.#state.operation = QUERY_OPERATION.UPDATE;
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

  public clear(): void {
    this.#state.bindValues = [];
    this.#state.missingComponents = [];
    this.#state.operation = null;
    this.#state.query = '';
  }

  public toString(): string {
    this.#state.query = `${this.#state.query.trim()} ${this.#state.missingComponents.join(' ')}`.trim();
    return this.#state.query;
  }

  public inspect(): Pair<string, any[]> {
    return new Pair(this.#state.query.slice(0), this.#state.bindValues.slice(0));
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


type SchemaBuilderState = {
  operation: QUERY_OPERATION | null;
  allowExternalAccess: boolean;
  queries: string[];
  builder: PostgresBuilder<any>;
  temp: Map<string, any>;
}


export type FieldOptions = {
  notNull?: boolean;
  unique?: boolean;
  primaryKey?: boolean;
  check?: string;
  default?: any;
};

class PostgresSchemaBuilder {
  readonly #state: SchemaBuilderState;

  public constructor(
    _cnp: string | ConnectionProps,
    _options?: { ssl?: boolean } // eslint-disable-line comma-dangle
  ) {
    let datname = '';

    if (typeof _cnp === 'string') {
      datname = new URL(_cnp).pathname;
    } else {
      datname = _cnp.database;
    }

    this.#state = {
      allowExternalAccess: false,
      operation: null,
      queries: [],
      builder: new PostgresBuilder(datname, '', _cnp, _options?.ssl),
      temp: new Map(),
    };
  }

  public createTable(tablename: string, _methods: (builder: this) => void): this {
    if (this.#state.temp.has('create_table')) {
      throw new Exception('You can only create one table at a time', 'ERR_UNSUPPORTED_OPERATION');
    }

    this.#state.temp.set('create_table', `CREATE TABLE ${tablename} IF NOT EXISTS (`);

    this.#state.allowExternalAccess = true;
    _methods(this);
    this.#state.allowExternalAccess = false;

    this.#state.queries.push(`${(this.#state.temp.get('create_table') as string).trim().replace(/,\s*$/, '')})`);
    this.#state.temp.delete('create_table');

    return this;
  }

  public createEnum(typename: string, members: string[]): this {
    this.#state.queries.push(`CREATE TYPE ${typename} AS ENUM(${members.join(', ')})`);
    return this;
  }

  public text(field: string, options?: FieldOptions): this {
    return this._addField(field, 'TEXT', options);
  }

  public integer(field: string, options?: FieldOptions): this {
    return this._addField(field, 'INTEGER', options);
  }

  public boolean(field: string, options?: FieldOptions): this {
    return this._addField(field, 'BOOLEAN', options);
  }

  public date(field: string, options?: FieldOptions): this {
    return this._addField(field, 'DATE', options);
  }

  public timestamp(field: string, options?: FieldOptions): this {
    return this._addField(field, 'TIMESTAMP', options);
  }

  public array(field: string, elementType: string, options?: FieldOptions): this {
    return this._addField(field, `${elementType}[]`, options);
  }
  
  public json(field: string, options?: FieldOptions): this {
    return this._addField(field, 'JSON', options);
  }
  
  public jsonb(field: string, options?: FieldOptions): this {
    return this._addField(field, 'JSONB', options);
  }
  
  public numeric(field: string, precision?: number, scale?: number, options?: FieldOptions): this {
    const type = precision !== undefined && scale !== undefined
      ? `NUMERIC(${precision}, ${scale})`
      : 'NUMERIC';

    return this._addField(field, type, options);
  }
  
  public char(field: string, length?: number, options?: FieldOptions): this {
    const type = length !== undefined ? `CHAR(${length})` : 'CHAR';
    return this._addField(field, type, options);
  }
  
  public varchar(field: string, length?: number, options?: FieldOptions): this {
    const type = length !== undefined ? `VARCHAR(${length})` : 'VARCHAR';
    return this._addField(field, type, options);
  }
  
  public float(field: string, options?: FieldOptions): this {
    return this._addField(field, 'FLOAT', options);
  }
  
  public double(field: string, options?: FieldOptions): this {
    return this._addField(field, 'DOUBLE PRECISION', options);
  }
  
  public smallint(field: string, options?: FieldOptions): this {
    return this._addField(field, 'SMALLINT', options);
  }
  
  public bigint(field: string, options?: FieldOptions): this {
    return this._addField(field, 'BIGINT', options);
  }
  
  public serial(field: string, options?: FieldOptions): this {
    return this._addField(field, 'SERIAL', options);
  }
  
  public bigserial(field: string, options?: FieldOptions): this {
    return this._addField(field, 'BIGSERIAL', options);
  }

  public binary(field: string, options?: FieldOptions): this {
    return this._addField(field, 'BYTEA', options);
  }
  
  public enum(field: string, enumName: string, options?: FieldOptions): this {
    return this._addField(field, `${enumName}`, options);
  }
  
  public geography(field: string, type: string, srid: number, options?: FieldOptions): this {
    return this._addField(field, `GEOGRAPHY(${type}, ${srid})`, options);
  }
  
  public geometry(field: string, type: string, srid: number, options?: FieldOptions): this {
    return this._addField(field, `GEOMETRY(${type}, ${srid})`, options);
  }
  
  public point(field: string, options?: FieldOptions): this {
    return this._addField(field, 'POINT', options);
  }

  public toString(): string {
    return this.#state.queries.join(';\n\n');
  }

  public inspect(): string[] {
    return [...this.#state.queries];
  }

  private _addField(field: string, type: string, options?: FieldOptions): this {
    if(!this.#state.allowExternalAccess) {
      throw new Exception('Cannot access field descriptor tables without access', 'ERR_UNSUPPORTED_OPERATION');
    }

    let fieldOptions = '';

    if(options?.notNull) {
      fieldOptions += ' NOT NULL';
    }

    if(options?.primaryKey) {
      fieldOptions += ' PRIMARY KEY';
    }

    if(options?.unique) {
      fieldOptions += ' UNIQUE';
    }

    if(options?.check) {
      fieldOptions += ` CHECK (${options.check})`;
    }

    if(options?.default !== undefined) {
      fieldOptions += ` DEFAULT '${options.default}'`;
    }

    if(this.#state.temp.has('create_table')) {
      const prev = this.#state.temp.get('create_table') as string;
      this.#state.temp.set('create_table', `${prev}, ${field} ${type}${fieldOptions}`);
    }

    return this;
  }

  public async execute(): Promise<_Result<any>[]> {
    this.#state.builder.clear();
    await this.#state.builder.raw('BEGIN').execute();

    try {
      const results = await Promise.all(
        this.#state.queries.map((query) => {
          this.#state.builder.clear();
          return this.#state.builder.raw(query).execute();
        }) // eslint-disable-line comma-dangle
      );

      this.#state.builder.clear();
      await this.#state.builder.raw('COMMIT').execute();

      return results;
    } catch (err) {
      this.#state.builder.clear();
      await this.#state.builder.raw('ROLLBACK').execute();

      throw err;
    }
  }
}


export function createClient<T>(connection: string | ConnectionProps, options?: { ssl?: boolean }): { readonly sql: <K extends keyof T>(table: K | Omit<string, K>) => PostgresBuilder<T[K]>; readonly schema: PostgresSchemaBuilder } {
  let datname: string;

  if(typeof connection === 'string') {
    datname = new URL(connection).pathname;
  } else {
    datname = connection.database;
  }

  return Object.freeze({
    sql: ((table: any) => {
      return new PostgresBuilder(datname, table as string, connection, options?.ssl);
    }) as any,

    schema: new PostgresSchemaBuilder(connection, { ssl: options?.ssl }),
  });
}
