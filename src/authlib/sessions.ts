import { hasher } from 'cryptx-sdk/hash';

import { aesEncrypt } from '../crypto';
import { assert } from '../@internals/util';
import { stringifySpecies } from './database';
import { Exception } from '../@internals/errors';
import Entity from '../@internals/domain/entity';
import type { PrimitiveDictionary } from '../types';
import { DatabaseDriver } from './database/drivers';
import { jsonSafeStringify } from 'src/@internals/json';
import { optionalBuffer, optionalDefined, unwrap } from '../option';


export type SessionRole = 'transactional' | 'auth' | 'authx' | 'e-tag' | 'transport';

export const validSessionRoles: readonly SessionRole[] = Object.freeze([
  'transactional', 'auth', 'authx', 'e-tag', 'transport',
] as const);


export const enum SIG_ALG {
  K_AES_HMAC_SHA_256_512 = 72,
}


export type SessionDocument = {
  readonly sessionId: string;
  readonly expiresAt?: string;
  readonly headers: PrimitiveDictionary;
  readonly payload: PrimitiveDictionary;
  readonly signature: Buffer;
  readonly signAlgorithm: SIG_ALG;
  readonly ckeln: number;
  readonly sourceIpAddress?: { readonly type: 'IPv4' | 'IPv6'; readonly value: string; };
  readonly sourceUserAgent?: string;
  readonly role: SessionRole;
  readonly abstractResources: PrimitiveDictionary;
  readonly userId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

type SessionProps = {
  headers?: PrimitiveDictionary;
  payload?: PrimitiveDictionary;
  abstractResources?: PrimitiveDictionary;
  expiresAt?: string | Date;
  signature?: string;
  signAlgorithm?: SIG_ALG;
  cklen?: number;
  srcIp?: string;
  srcUa?: string;
  role: SessionRole;
  userId?: string;
  _keys?: readonly Uint8Array[];
  _ke?: BufferEncoding;
  _dprefix?: string;
  _dd: DatabaseDriver;
  createdAt?: string;
  updatedAt?: string;
};


export class Session extends Entity<SessionProps> {
  public get sessionId(): string {
    return this._id;
  }

  public static async transaction(props: Omit<SessionProps, 'role'>): Promise<Session> {
    const [signKey, encKey] = Session.#retrieveKeys(props._keys, props._ke);
    props._keys = null!;

    if(!!props._dprefix && props._dprefix[props._dprefix.length - 1] !== '_') {
      props._dprefix += '_';
    }

    const query = `INSERT INTO
      ${props._dprefix}auth_sessions (session_id,
      expires_at,
      headers,
      payload,
      signature,
      sign_algorithm,
      ck_len,
      src_ip,
      src_ua,
      role,
      abstract_r,
      user_id,
      created_at,
      updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12, $13, $14) RETURNING *`;

    try {
      if(props._dd.__brand !== 'sql') {
        throw new Exception('Sessions didn\'t support non-sql databases yet', 'ERR_UNSUPPORTED_OPERATION');
      }

      const headers = Object.assign({ 'x-sdt': 'tt' }, props.headers);
      const headerEntrieRows = [] as string[];

      for(const prop in headers) {
        if(!['string', 'number', 'boolean'].includes(typeof headers[prop]) && !!headers[prop]) {
          throw new Exception('Session headers must be a single top-level object { [key] -> str | numeric | bool | null }', 'ERR_INVALID_ARGUMENT');
        }

        headerEntrieRows.push(`${encodeURIComponent(prop)}=${encodeURIComponent(stringifySpecies(headers[prop]))}`);
      }

      const eh = await aesEncrypt(headerEntrieRows.join('|'), encKey, 'base64');

      if(!props.payload) {
        props.payload = { '[NULL ENTRYPOINT]': null };
      }

      const payloadEntrieRows = [] as string[];

      for(const prop in props.payload) {
        if(!['string', 'number', 'boolean'].includes(typeof props.payload[prop]) && !!props.payload[prop]) {
          throw new Exception('Session payload must be a single top-level object { [key] -> str | numeric | bool | null }', 'ERR_INVALID_ARGUMENT');
        }

        payloadEntrieRows.push(`${encodeURIComponent(prop)}=${encodeURIComponent(stringifySpecies(props.payload[prop]))}`);
      }

      const ep = await aesEncrypt(payloadEntrieRows.join('|'), encKey, 'base64');
      const sign = await Session.#signPayload(SIG_ALG.K_AES_HMAC_SHA_256_512, props.payload, signKey);

      const results = await props._dd.query(query, {
        values: [
          Entity.generateId('uuid-without-dashes'),
          (props.expiresAt ? props.expiresAt instanceof Date ? props.expiresAt : new Date(props.expiresAt) : undefined)?.toISOString() || null,
          eh,
          ep,
          sign.toString('base64'),
          SIG_ALG.K_AES_HMAC_SHA_256_512,
          null,
          props.srcIp ? (await aesEncrypt(props.srcIp, encKey, 'base64')) : null,
          props.srcUa ? (await aesEncrypt(props.srcUa, encKey, 'base64')) : null,
          'transactional',
          jsonSafeStringify(props.abstractResources || {}),
          props.userId || null,
          new Date().toISOString(),
          new Date().toISOString(),
        ],
      });

      assert(results.rows[0].sign_algorithm === SIG_ALG.K_AES_HMAC_SHA_256_512);

      return new Session({
        userId: results.rows[0].user_id,
        role: results.rows[0].role,
        _dd: props._dd,
        _dprefix: props._dprefix,
        abstractResources: results.rows[0].abstract_r,
        cklen: results.rows[0].ck_len,
        _ke: props._ke,
        _keys: props._keys,
        headers: headers,
        payload: props.payload,
        signAlgorithm: SIG_ALG.K_AES_HMAC_SHA_256_512,
        signature: results.rows[0].signature,
        srcIp: props.srcIp,
        srcUa: props.srcUa,
        createdAt: results.rows[0].created_at instanceof Date ?
          results.rows[0].created_at.toISOString() :
          results.rows[0].created_at,
        expiresAt: results.rows[0].expires_at ?
          results.rows[0].expires_at instanceof Date ? 
            results.rows[0].expires_at.toISOString() :
            results.rows[0].expires_at
          : null,
        updatedAt: results.rows[0].updated_at instanceof Date ?
          results.rows[0].updated_at.toISOString() :
          results.rows[0].updated_at,
      }, results.rows[0].session_id);
    } finally {
      await props._dd.close();
    }
  }

  static #retrieveKeys(k: readonly Uint8Array[] = [], encoding?: BufferEncoding): readonly [Buffer, Buffer] {
    let s: Buffer | null = null, e: Buffer | null = null;

    if(!k[0] && !process?.env.SIG_KEY) {
      throw new Exception('Cannot retrieve session sig key', 'ERR_MISSING_ENVIRONMENT_KEY');
    }

    if(k[0]) {
      s = Buffer.isBuffer(k[0]) ? k[0] : Buffer.from(k[0]);
    } else {
      s = Buffer.from(unwrap( optionalDefined( process.env.SIG_KEY ) ), encoding);
    }
    
    if(!k[1] && !process?.env.ENC_KEY) {
      throw new Exception('Cannot retrieve session sig key', 'ERR_MISSING_ENVIRONMENT_KEY');
    }

    if(k[1]) {
      e = Buffer.isBuffer(k[1]) ? k[1] : Buffer.from(k[1]);
    } else {
      e = Buffer.from(unwrap( optionalDefined( process.env.ENC_KEY ) ), encoding);
    }

    return Object.freeze([ s, e ]);
  }

  static async #signPayload(alg: SIG_ALG, p?: PrimitiveDictionary, k?: Buffer): Promise<Buffer> {
    if(alg !== SIG_ALG.K_AES_HMAC_SHA_256_512) {
      throw new Exception(`Algorithm '${alg}' is not supported yet`, 'ERR_UNSUPPORTED_OPERATION');
    }

    const payload = { ...(p || {}) };
    delete payload['[NULL ENTRYPOINT]'];

    const optionPayload = optionalDefined(jsonSafeStringify(payload));

    const u8 = await hasher.hmac(
      Buffer.from(unwrap(optionPayload)),
      unwrap( optionalBuffer(k) ),
      'sha512',
      'bytearray' // eslint-disable-line comma-dangle
    );

    return Buffer.from(u8);
  }
}

export default Session;
