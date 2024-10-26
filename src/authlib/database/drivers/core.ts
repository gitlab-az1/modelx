import type { QueryOptions } from './pg';
import type { QueryResult, PoolClient } from 'pg';


export interface AuthLibSQLDatabaseDriver<TransactionClient, QOptions, QReturn> {
  readonly __brand: 'sql';

  transaction<T>(callback: (client: TransactionClient) => Promise<T>): Promise<T>;
  query(query: string, options?: QOptions): Promise<QReturn>;
  isOnline(): Promise<boolean>;
  close(): Promise<void>;
}

export interface AuthLibNonSQLDatabaseDriver {
  readonly __brand: 'non-sql';

  isOnline(): Promise<boolean>;
  close(): Promise<void>;
}


export type DatabaseDriver = AuthLibNonSQLDatabaseDriver | AuthLibSQLDatabaseDriver<PoolClient, QueryOptions, QueryResult>;
