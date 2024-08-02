import math from 'next-math';

import { assert } from '../@internals/util';
import { Exception } from '../@internals/errors';


let _nodebuf: Buffer = null!;
let _msize: number = null!;
let _mrank: number = null!;
let _mins: number = null!;
let _tbytes: number = null!;
let _breq: number = null!;
let _balloc: number = null!;
let _bwasted: number = null!;
let _flist: any[] = null!;


export function meminit(byteSize: number, msize: number = 1): void {
  if(!!_nodebuf && Buffer.isBuffer(_nodebuf)) {
    throw new Exception(`Memory management allocator is already initialized with [maxsize=0x${_msize.toString(16)}]`, 'ERR_UNSUPPORTED_OPERATION');
  }

  assert(byteSize > 1 && Number.isInteger(byteSize));

  const len = 1 << ((math.log(byteSize - 1) / math.LN2) + 1);
  assert(!(len & (len - 1)));

  _msize = len;
  _nodebuf = Buffer.alloc(len);
  _mrank = (math.log(msize) / math.LN2) | 0;
  _mins = 1 << _mrank;
  _tbytes = len;
  _breq = _balloc = _bwasted = 0;
  _flist = [];

  for(let i = 0; i < (math.log(len) / math.LN2) - _mrank; i++) {
    _flist.push([]);
  }

  _flist.push([0]);
}


export function memsize(): number {
  if(_nodebuf === null || _msize === null) return -1;
  return _msize;
}

export function initialized(): boolean {
  return !!_msize;
}

export function destroy(): boolean {
  if(!_nodebuf) return false;
  
  _nodebuf = null!;
  _msize = null!;
  _mrank = null!;
  _mins = null!;
  _tbytes = null!;
  _breq = null!;
  _balloc = null!;
  _bwasted = null!;
  _flist = null!;

  return true;
}


export function __dev_print__() {
  console.log({
    _nodebuf,
    _msize,
    _mrank,
    _mins,
    _tbytes,
    _breq,
    _balloc,
    _bwasted,
    _flist,
  });
}
