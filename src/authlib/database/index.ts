import { Exception } from '../../@internals/errors';
import { AuthLibNonSQLDatabaseDriver, AuthLibSQLDatabaseDriver } from './drivers';


export async function seedTables(driver: AuthLibNonSQLDatabaseDriver | AuthLibSQLDatabaseDriver<any, any, any>): Promise<void> {
  if(driver.__brand !== 'sql') {
    throw new Exception('We didn\'t support non-sql databases yet.', 'ERR_UNSUPPORTED_OPERATION');
  }

  if(!(await driver.isOnline())) {
    throw new Exception(`Database driver '${driver.__brand}' is not online`, 'ERR_DATABASE_ERROR');
  }

  
}


export function stringifySpecies(arg?: string | number | boolean | null): string {
  if(!arg) return '[NULL]';
  if(typeof arg === 'boolean') return `[${arg ? 'TRUE' : 'FALSE'}]`;
  if(typeof arg === 'number') return `@n{${arg}}`;
  return String(arg);
}

export function parseSpecies(arg: string): string | number | boolean | null {
  if(arg === '[NULL]') return null;
  if(arg === '[TRUE]' || arg === '[FALSE]') return arg === '[TRUE]';
  if(arg.startsWith('@n{')) return Number(arg.slice(3, -1));
  return String(arg);
}
