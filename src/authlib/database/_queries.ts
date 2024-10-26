import { optionalDefined, unwrapOr } from '../../option';


export function dropTables(prefix?: string): string {
  prefix = unwrapOr(optionalDefined(prefix), '');

  if(!!prefix && prefix[prefix.length - 1] !== '_') {
    prefix += '_';
  }

  return `DROP TABLE ${prefix}auth_sessions CASCADE;
  DROP TABLE ${prefix}tokens CASCADE;
  DROP TABLE ${prefix}users CASCADE;`;
}

export function createTables(prefix?: string): string {
  let q: string = 'CREATE TABLE IF NOT EXISTS ';

  prefix = unwrapOr(optionalDefined(prefix), '');

  if(!!prefix && prefix[prefix.length - 1] !== '_') {
    prefix += '_';
  }

  q += `${prefix}users (
  user_id VARCHAR(128) NOT NULL UNIQUE PRIMARY KEY,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  birth_date DATE NULL,
  email_address TEXT NOT NULL UNIQUE,
  email_hash TEXT NOT NULL UNIQUE,
  password_digest TEXT NOT NULL,
  salt TEXT NOT NULL UNIQUE,
  key_derivation_algorithm INTEGER NOT NULL DEFAULT 1,
  features TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL
  `;

  q += ');';

  q += `${prefix}auth_sessions (
  session_id VARCHAR(128) NOT NULL UNIQUE PRIMARY KEY,
  expires_at TIMESTAMP WITH TIME ZONE NULL,
  headers TEXT NOT NULL,
  payload TEXT NOT NULL,
  signature TEXT NOT NULL,
  sign_algorithm INTEGER NOT NULL,
  ck_len INTEGER NOT NULL DEFAULT 768,
  src_ip TEXT NULL,
  src_ua TEXT NULL,
  role VARCHAR(16) NOT NULL CHECK (role IN ('transactional', 'auth', 'authx', 'e-tag', 'transport')) DEFAULT 'auth',
  abstract_r JSON NOT NULL DEFAULT '{}'::JSON,
  user_id VARCHAR(128) NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  FOREIGN KEY (user_id) REFERENCES ${prefix}users (user_id)`;

  q += ');';

  q += `${prefix}tokens (
  token_id VARCHAR(128) NOT NULL UNIQUE PRIMARY KEY,`;

  q += ');';

  return q;
}
