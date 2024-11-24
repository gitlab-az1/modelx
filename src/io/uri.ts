/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import CharCode from '../character-codes';


export interface UriComponents {
	scheme: string;
	authority?: string;
	path?: string;
	query?: string;
	fragment?: string;
}

export function isUriComponents(thing: unknown): thing is UriComponents {
  if(!thing || typeof thing !== 'object') return false;

  return typeof (<UriComponents>thing).scheme === 'string'
		&& (typeof (<UriComponents>thing).authority === 'string' || typeof (<UriComponents>thing).authority === 'undefined')
		&& (typeof (<UriComponents>thing).path === 'string' || typeof (<UriComponents>thing).path === 'undefined')
		&& (typeof (<UriComponents>thing).query === 'string' || typeof (<UriComponents>thing).query === 'undefined')
		&& (typeof (<UriComponents>thing).fragment === 'string' || typeof (<UriComponents>thing).fragment === 'undefined');
}


const _schemePattern = /^\w[\w\d+.-]*$/;
const _singleSlashStart = /^\//;
const _doubleSlashStart = /^\/\//;
const _empty = '';
const _slash = '/';
const _regexp = /^(([^:/?#]+?):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/;


function _validateUri(ret: URI, _strict?: boolean): void {

  // scheme, must be set
  if(!ret.scheme && _strict) {
    throw new Error(`[UriError]: Scheme is missing: {scheme: "", authority: "${ret.authority}", path: "${ret.path}", query: "${ret.query}", fragment: "${ret.fragment}"}`);
  }

  // scheme, https://tools.ietf.org/html/rfc3986#section-3.1
  // ALPHA *( ALPHA / DIGIT / "+" / "-" / "." )
  if(ret.scheme && !_schemePattern.test(ret.scheme)) {
    throw new Error('[UriError]: Scheme contains illegal characters.');
  }

  // path, http://tools.ietf.org/html/rfc3986#section-3.3
  // If a URI contains an authority component, then the path component
  // must either be empty or begin with a slash ("/") character.  If a URI
  // does not contain an authority component, then the path cannot begin
  // with two slash characters ("//").
  if(ret.path) {
    if(ret.authority) {
      if(!_singleSlashStart.test(ret.path)) {
        throw new Error('[UriError]: If a URI contains an authority component, then the path component must either be empty or begin with a slash ("/") character');
      }
    } else {
      if(_doubleSlashStart.test(ret.path)) {
        throw new Error('[UriError]: If a URI does not contain an authority component, then the path cannot begin with two slash characters ("//")');
      }
    }
  }
}

// for a while we allowed uris *without* schemes and this is the migration
// for them, e.g. an uri without scheme and without strict-mode warns and falls
// back to the file-scheme. that should cause the least carnage and still be a
// clear warning
function _schemeFix(scheme: string, _strict: boolean): string {
  if(!scheme && !_strict) return 'file';
  return scheme;
}


export class URI {
  /**
	 * scheme is the 'http' part of 'http://www.example.com/some/path?query#fragment'.
	 * The part before the first colon.
	 */
  readonly scheme: string;

  /**
	 * authority is the 'www.example.com' part of 'http://www.example.com/some/path?query#fragment'.
	 * The part between the first double slashes and the next slash.
	 */
  readonly authority: string;

  /**
	 * path is the '/some/path' part of 'http://www.example.com/some/path?query#fragment'.
	 */
  readonly path: string;

  /**
	 * query is the 'query' part of 'http://www.example.com/some/path?query#fragment'.
	 */
  readonly query: string;

  /**
	 * fragment is the 'fragment' part of 'http://www.example.com/some/path?query#fragment'.
	 */
  readonly fragment: string;

  /**
	 * @internal
	 */
  protected constructor(scheme: string, authority?: string, path?: string, query?: string, fragment?: string, _strict?: boolean);

  /**
	 * @internal
	 */
  protected constructor(components: UriComponents, _strict?: boolean);

  protected constructor(
    schemeOrComponents: string | UriComponents,
    authorityOrStrict?: string | boolean,
    path?: string,
    query?: string,
    fragment?: string,
    _strict?: boolean // eslint-disable-line comma-dangle
  ) {
    let components: UriComponents;

    if(typeof schemeOrComponents === 'string') {
      if(typeof authorityOrStrict === 'boolean') {
        throw new Error('[UriError]: When scheme is string you cannot set `_strict` as the second parameter');
      }

      // If string scheme is provided
      const scheme = _schemeFix(schemeOrComponents, _strict || false);

      components = { scheme, authority: authorityOrStrict, path, query, fragment };
      components.path = _referenceResolution(this.scheme, path || _empty);
    } else {
      // If UriComponents object is provided
      components = schemeOrComponents;

      if(typeof authorityOrStrict === 'boolean') {
        _strict = authorityOrStrict;
      }
    }

    this.scheme = components.scheme;
    this.authority = components.authority || _empty;
    this.path = components.path || _empty;
    this.query = components.query || _empty;
    this.fragment = components.fragment || _empty;

    _validateUri(this, _strict);
  }

  public with(change: { scheme?: string; authority?: string | null; path?: string | null; query?: string | null; fragment?: string | null }): URI {
    if(!change) return this;
    let { scheme, authority, path, query, fragment } = change;

    if(scheme === undefined) {
      scheme = this.scheme;
    } else if(scheme === null) {
      scheme = _empty;
    }

    if(authority === undefined) {
      authority = this.authority;
    } else if(authority === null) {
      authority = _empty;
    }

    if(path === undefined) {
      path = this.path;
    } else if(path === null) {
      path = _empty;
    }

    if(query === undefined) {
      query = this.query;
    } else if(query === null) {
      query = _empty;
    }

    if(fragment === undefined) {
      fragment = this.fragment;
    } else if(fragment === null) {
      fragment = _empty;
    }

    if(scheme === this.scheme
			&& authority === this.authority
			&& path === this.path
			&& query === this.query
			&& fragment === this.fragment) return this;

    return new URI(scheme, authority, path, query, fragment);
  }

  public toFileSystemPath(): string {
    return uriToFsPath(this, false);
  }

  public toString(skipEncoding: boolean = false): string {
    return _asFormatted(this, skipEncoding);
  }

  public static parse(value: string, _strict: boolean = false): URI {
    const match = _regexp.exec(value);
    if(!match) return new URI(_empty, _empty, _empty, _empty, _empty);
		
    return new URI(
      match[2] || _empty,
      percentDecode(match[4] || _empty),
      percentDecode(match[5] || _empty),
      percentDecode(match[7] || _empty),
      percentDecode(match[9] || _empty),
      _strict // eslint-disable-line comma-dangle
    );
  }

  public static from(components: UriComponents, strict?: boolean): URI {
    return new URI(
      components.scheme,
      components.authority,
      components.path,
      components.query,
      components.fragment,
      strict // eslint-disable-line comma-dangle
    );
  }

  /**
  * Creates a new URI from a file system path, e.g. `c:\my\files`,
  * `/usr/home`, or `\\server\share\some\path`.
  *
  * The *difference* between `URI#parse` and `URI#file` is that the latter treats the argument
  * as path, not as stringified-uri. E.g. `URI.file(path)` is **not the same as**
  * `URI.parse('file://' + path)` because the path might contain characters that are
  * interpreted (# and ?). See the following sample:
  * ```ts
 const good = URI.file('/coding/c#/project1');
 good.scheme === 'file';
 good.path === '/coding/c#/project1';
 good.fragment === '';
 const bad = URI.parse('file://' + '/coding/c#/project1');
 bad.scheme === 'file';
 bad.path === '/coding/c'; // path is now broken
 bad.fragment === '/project1';
 ```
  *
  * @param path A file system path (see `URI#fsPath`)
  */
  public static file(path: string, isWindows?: boolean): URI {
    let authority = _empty;

    // normalize to fwd-slashes on windows,
    // on other systems bwd-slashes are valid
    // filename character, eg /f\oo/ba\r.txt
    if(isWindows) {
      path = path.replace(/\\/g, _slash);
    }

    // check for authority as used in UNC shares
    // or use the path as given
    if(path[0] === _slash && path[1] === _slash) {
      const idx = path.indexOf(_slash, 2);

      if(idx === -1) {
        authority = path.substring(2);
        path = _slash;
      } else {
        authority = path.substring(2, idx);
        path = path.substring(idx) || _slash;
      }
    }

    return new URI('file', authority, path, _empty, _empty);
  }
}


function encodeURIComponentFast(uriComponent: string, isPath: boolean, isAuthority: boolean): string {
  let res: string | undefined = undefined;
  let nativeEncodePos = -1;

  for(let pos = 0; pos < uriComponent.length; pos++) {
    const code = uriComponent.charCodeAt(pos);

    // unreserved characters: https://tools.ietf.org/html/rfc3986#section-2.3
    if(
      (code >= CharCode.a && code <= CharCode.z)
			|| (code >= CharCode.A && code <= CharCode.Z)
			|| (code >= CharCode.Digit0 && code <= CharCode.Digit9)
			|| code === CharCode.Dash
			|| code === CharCode.Period
			|| code === CharCode.Underline
			|| code === CharCode.Tilde
			|| (isPath && code === CharCode.Slash)
			|| (isAuthority && code === CharCode.OpenSquareBracket)
			|| (isAuthority && code === CharCode.CloseSquareBracket)
			|| (isAuthority && code === CharCode.Colon)
    ) {
      // check if we are delaying native encode
      if(nativeEncodePos !== -1) {
        res += encodeURIComponent(uriComponent.substring(nativeEncodePos, pos));
        nativeEncodePos = -1;
      }

      // check if we write into a new string (by default we try to return the param)
      if(res !== undefined) {
        res += uriComponent.charAt(pos);
      }

    } else {
      // encoding needed, we need to allocate a new string
      if(res === undefined) {
        res = uriComponent.substr(0, pos);
      }

      // check with default table first
      const escaped = encodeTable[code];
      if(escaped !== undefined) {

        // check if we are delaying native encode
        if(nativeEncodePos !== -1) {
          res += encodeURIComponent(uriComponent.substring(nativeEncodePos, pos));
          nativeEncodePos = -1;
        }

        // append escaped variant to result
        res += escaped;

      } else if(nativeEncodePos === -1) {
        // use native encode only when needed
        nativeEncodePos = pos;
      }
    }
  }

  if(nativeEncodePos !== -1) {
    res += encodeURIComponent(uriComponent.substring(nativeEncodePos));
  }

  return res !== undefined ? res : uriComponent;
}

function encodeURIComponentMinimal(path: string): string {
  let res: string | undefined = undefined;

  for(let pos = 0; pos < path.length; pos++) {
    const code = path.charCodeAt(pos);

    if(code === CharCode.Hash || code === CharCode.QuestionMark) {
      if(res === undefined) {
        res = path.substr(0, pos);
      }

      res += encodeTable[code];
    } else {
      if(res !== undefined) {
        res += path[pos];
      }
    }
  }

  return res !== undefined ? res : path;
}

export function uriToFsPath(uri: URI, keepDriveLetterCasing: boolean, isWindows?: boolean): string {
  let value: string;

  if(uri.authority && uri.path.length > 1 && uri.scheme === 'file') {
    // unc path: file://shares/c$/far/boo
    value = `//${uri.authority}${uri.path}`;
  } else if (
    uri.path.charCodeAt(0) === CharCode.Slash
		&& (uri.path.charCodeAt(1) >= CharCode.A && uri.path.charCodeAt(1) <= CharCode.Z || uri.path.charCodeAt(1) >= CharCode.a && uri.path.charCodeAt(1) <= CharCode.z)
		&& uri.path.charCodeAt(2) === CharCode.Colon
  ) {
    if(!keepDriveLetterCasing) {
      // windows drive letter: file:///c:/far/boo
      value = uri.path[1].toLowerCase() + uri.path.substr(2);
    } else {
      value = uri.path.substr(1);
    }
  } else {
    // other path
    value = uri.path;
  }

  if(isWindows) {
    value = value.replace(/\//g, '\\');
  }

  return value;
}

/**
 * Create the external version of a uri
 */
function _asFormatted(uri: URI, skipEncoding: boolean): string {
  const encoder = !skipEncoding
    ? encodeURIComponentFast
    : encodeURIComponentMinimal;

  let res = '';
  let { scheme, authority, path, query, fragment } = uri; // eslint-disable-line prefer-const

  if(scheme) {
    res += scheme;
    res += ':';
  }

  if(authority || scheme === 'file') {
    res += _slash;
    res += _slash;
  }

  if(authority) {
    let idx = authority.indexOf('@');

    if(idx !== -1) {
      // <user>@<auth>
      const userinfo = authority.substr(0, idx);
      authority = authority.substr(idx + 1);
      idx = userinfo.lastIndexOf(':');

      if(idx === -1) {
        res += encoder(userinfo, false, false);
      } else {
        // <user>:<pass>@<auth>
        res += encoder(userinfo.substr(0, idx), false, false);
        res += ':';
        res += encoder(userinfo.substr(idx + 1), false, true);
      }

      res += '@';
    }

    authority = authority.toLowerCase();
    idx = authority.lastIndexOf(':');

    if(idx === -1) {
      res += encoder(authority, false, true);
    } else {
      // <auth>:<port>
      res += encoder(authority.substr(0, idx), false, true);
      res += authority.substr(idx);
    }
  }

  if(path) {
    // lower-case windows drive letters in /C:/fff or C:/fff
    if(path.length >= 3 && path.charCodeAt(0) === CharCode.Slash && path.charCodeAt(2) === CharCode.Colon) {
      const code = path.charCodeAt(1);

      if(code >= CharCode.A && code <= CharCode.Z) {
        path = `/${String.fromCharCode(code + 32)}:${path.substr(3)}`; // "/c:".length === 3
      }
    } else if(path.length >= 2 && path.charCodeAt(1) === CharCode.Colon) {
      const code = path.charCodeAt(0);

      if(code >= CharCode.A && code <= CharCode.Z) {
        path = `${String.fromCharCode(code + 32)}:${path.substr(2)}`; // "/c:".length === 3
      }
    }

    // encode the rest of the path
    res += encoder(path, true, false);
  }

  if(query) {
    res += '?';
    res += encoder(query, false, false);
  }

  if(fragment) {
    res += '#';
    res += !skipEncoding ? encodeURIComponentFast(fragment, false, false) : fragment;
  }

  return res;
}

function _referenceResolution(scheme: string, path: string): string {

  // the slash-character is our 'default base' as we don't
  // support constructing URIs relative to other URIs. This
  // also means that we alter and potentially break paths.
  // see https://tools.ietf.org/html/rfc3986#section-5.1.4
  switch(scheme) {
    case 'https':
    case 'http':
    case 'file':
      if(!path) {
        path = _slash;
      } else if (path[0] !== _slash) {
        path = _slash + path;
      }

      break;
  }

  return path;
}

// --- decode

function decodeURIComponentGraceful(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    if(str.length > 3) return str.substr(0, 3) + decodeURIComponentGraceful(str.substr(3));
    return str;
  }
}

const _rEncodedAsHex = /(%[0-9A-Za-z][0-9A-Za-z])+/g;

function percentDecode(str: string): string {
  if(!str.match(_rEncodedAsHex)) return str;
  return str.replace(_rEncodedAsHex, (match) => decodeURIComponentGraceful(match));
}

// reserved characters: https://tools.ietf.org/html/rfc3986#section-2.2
const encodeTable: { [ch: number]: string } = {
  [CharCode.Colon]: '%3A', // gen-delims
  [CharCode.Slash]: '%2F',
  [CharCode.QuestionMark]: '%3F',
  [CharCode.Hash]: '%23',
  [CharCode.OpenSquareBracket]: '%5B',
  [CharCode.CloseSquareBracket]: '%5D',
  [CharCode.AtSign]: '%40',

  [CharCode.ExclamationMark]: '%21', // sub-delims
  [CharCode.DollarSign]: '%24',
  [CharCode.Ampersand]: '%26',
  [CharCode.SingleQuote]: '%27',
  [CharCode.OpenParen]: '%28',
  [CharCode.CloseParen]: '%29',
  [CharCode.Asterisk]: '%2A',
  [CharCode.Plus]: '%2B',
  [CharCode.Comma]: '%2C',
  [CharCode.Semicolon]: '%3B',
  [CharCode.Equals]: '%3D',

  [CharCode.Space]: '%20',
};


export default URI;
