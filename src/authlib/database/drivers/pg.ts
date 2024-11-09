import { asyncRetry, Deferred } from 'typesdk/async';
import { type PoolConfig, type PoolClient, Pool, type QueryResult } from 'pg';

import { AuthLibSQLDatabaseDriver } from './core';
import { Exception } from '../../../@internals/errors';


export type PostgresConnectionProps = {
  user: string;
  password: string;
  database: string;
  host: string;
  port: number;
}

type DBCache = {
  pool: Pool | null;
  maxConnections: number | null;
  openedConnections: number | null;
  reservedConnections: number | null;
  openedConnectionsLastUpdate: number | null;
}

export type QueryOptions = {

  /**
   * The values to use for the query.
   */
  values?: any[];

  /**
   * The transaction to use for the query.
   */
  readonly transaction?: PoolClient;
}


export class PostgresDriver implements AuthLibSQLDatabaseDriver<PoolClient, QueryOptions, QueryResult> {
  readonly #config: PoolConfig;
  readonly #cache: DBCache;

  public constructor(connection: string | PostgresConnectionProps, isProduction?: boolean) {
    this.#config = {
      connectionTimeoutMillis: 2000,
      idleTimeoutMillis: 30000,
      max: 1,
      ssl: {
        rejectUnauthorized: false,
      },
      allowExitOnIdle: true,
    };

    if(typeof connection === 'string') {
      this.#config.connectionString = connection;
    } else {
      Object.assign(this.#config, connection);
    }

    if(!isProduction && process.env.NEXT_PUBLIC_POSTGRES_SSL_MODE !== 'require') {
      delete this.#config.ssl;
    }

    this.#cache = {
      pool: null,
      maxConnections: null,
      reservedConnections: null,
      openedConnections: null,
      openedConnectionsLastUpdate: null,
    };
  }

  public get __brand(): 'sql' {
    return 'sql' as const;
  }

  async #checkForTooManyConnections(client: PoolClient): Promise<boolean> {
    const currentTime = new Date().getTime();
    const openedConnectionsMaxAge = 5000;
    const maxConnectionsTolerance = 0.8;

    if(this.#cache.maxConnections === null || this.#cache.reservedConnections === null) {
      const [maxConnections, reservedConnections] = await getConnectionLimits();
      this.#cache.maxConnections = maxConnections;
      this.#cache.reservedConnections = reservedConnections;
    }

    if(this.#cache.openedConnections === null || currentTime - this.#cache.openedConnectionsLastUpdate! > openedConnectionsMaxAge) {
      const openedConnections = await getOpenedConnections();
      this.#cache.openedConnections = openedConnections;
      this.#cache.openedConnectionsLastUpdate = currentTime;
    }

    if(this.#cache.openedConnections! > (this.#cache.maxConnections! - this.#cache.reservedConnections!) * maxConnectionsTolerance) return true;

    return false;

    async function getConnectionLimits() {
      const [maxConnectionsResult, reservedConnectionResult] = await client.query(
        'SHOW max_connections; SHOW superuser_reserved_connections;',
      ) as any;
        
      return [
        maxConnectionsResult.rows[0].max_connections,
        reservedConnectionResult.rows[0].superuser_reserved_connections,
      ];
    }

    async function getOpenedConnections() {
      const openConnectionsResult = await client.query({
        text: 'SELECT numbackends as opened_connections FROM pg_stat_database where datname = $1',
        values: [process.env.POSTGRES_DB],
      });
      return openConnectionsResult.rows[0].opened_connections;
    }
  }

  async #TryToGetNewClientFromPool() {
    const newClientFromPool = async (): Promise<PoolClient> => {
      if(!this.#cache.pool) {
        this.#cache.pool = new Pool(this.#config);
      }
  
      return await this.#cache.pool.connect();
    };

    const clientFromPool = await asyncRetry<PoolClient>(newClientFromPool, {
      retries: 2,
      minTimeout: 150,
      maxTimeout: 5000,
      factor: 2,
    });
  
    return clientFromPool;
  }

  async #IsOnline(): Promise<boolean> {
    try {
      await this.#DoRunQuery('SELECT numbackends FROM pg_stat_database where datname = $1', {
        values: [process.env.POSTGRES_DB || process.env.NEXT_PUBLIC_POSTGRES_DB],
      });
  
      return true;
    } catch (err) {
      console.log(err);
      return false;
    }
  }

  async #GetOpenedConnections() {
    const openConnectionsResult = await this.#DoRunQuery(
      'SELECT numbackends as opened_connections FROM pg_stat_database where datname = $1',
      { values: [process.env.POSTGRES_DB] },
    );
    
    return openConnectionsResult.rows[0].opened_connections;
  }

  async #DoRunQuery(query: string, options?: QueryOptions): Promise<QueryResult> {
    let client: PoolClient | null = null;
    const deferredQueryPromise = new Deferred<QueryResult, Exception>();

    try {
      client = options?.transaction ? options!.transaction : await this.#TryToGetNewClientFromPool();
      const response = await client!.query(query, options?.values);
      deferredQueryPromise.resolve(response);
    } catch (err: any) {
      deferredQueryPromise.reject(new Exception(err.message ?? err, 'ERR_DATABASE_ERROR', { status: err.code || 500}));
    } finally {
      if(client && !options?.transaction) {
        const tooManyConnections = await this.#checkForTooManyConnections(client);
        client.release();

        if(tooManyConnections) {
          await this.#cache.pool?.end();
          this.#cache.pool = null;
        }
      }
    }

    return deferredQueryPromise.promise;
  }

  /**
   * Method to check if there are too many connections.
   * @param client - The PostgreSQL client.
   * @returns A promise that resolves to a boolean indicating if there are too many connections.
   */
  public checkForTooManyConnections(client: PoolClient): Promise<boolean> {
    return this.#checkForTooManyConnections(client);
  }

  /**
   * Method to get the number of opened connections.
   * @returns A promise that resolves to the number of opened connections.
   */
  public getOpenedConnections(): Promise<number> {
    return this.#GetOpenedConnections();
  }

  /**
   * Method to check if the database is online.
   * @returns A promise that resolves to a boolean indicating if the database is online.
   */
  public isOnline(): Promise<boolean> {
    return this.#IsOnline();
  }

  /**
   * Method to run a query.
   * @param query - The SQL query to run.
   * @param options - Additional options for the query.
   * @returns A promise that resolves to the query result.
   */
  public query(query: string, options?: QueryOptions): Promise<QueryResult> {
    return this.#DoRunQuery(query, options);
  }

  /**
   * Method to run a transaction.
   * @param callback - The callback function to execute within the transaction.
   * @returns A promise that resolves to the result of the transaction.
   */
  public async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.#TryToGetNewClientFromPool();
    await client.query('BEGIN');
    let result: T;

    try {
      result = await callback(client);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return result;
  }

  /**
   * Method to close the database connection pool.
   * @returns A promise that resolves when the connection pool is closed.
   */
  public async close(): Promise<void> {
    await this.#cache.pool?.end();
    this.#cache.pool = null;
  }
}

export default PostgresDriver;
