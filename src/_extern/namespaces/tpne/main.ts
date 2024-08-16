import path from 'path';
import { writeFile } from 'fs/promises';

import { uuid } from '../../../@internals/id';
import { floor, random } from '../../../math/native';
import { ensureDir, FILE_PERMISSION } from '../../../@internals/fs';


const url = 'https://thispersondoesnotexist.com';
const ua = [
  'x-nodefetch-psh 1.0.0',
  'x-powershell-con-client-d1 1.6.1',
  'http-user-agent 2.0.5',
  'power-tls-layer-agent-dense-2-v0 1.0.5',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Version/16.5 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:103.0) Gecko/20100101 Firefox/103.0',
];


export default async function(argc: number, args: readonly string[]) {
  let c: number = 1;
  let s: string = '0';

  for(let i = 0; i < argc; i++) {
    if(args[i] === '--count' || args[i] === '-c') {
      c = i + 1 > argc ? 1 : parseInt(args[i + 1]);
    } else if(args[i] === '--set' || args[i] === '-s') {
      s = i + 1 > argc ? '0' : args[i + 1];
    }

    if(c !== 1 && s !== '0') break;
  }

  const p = path.join(process.cwd(), 'tmp', 'tpne', `set-${s}`);
  await ensureDir(p);

  if(c < 1) {
    c = 1;
  }

  do {
    const agent = ua[floor(random() * ua.length) % ua.length];
    process.stdout.write(`Fetching %${c - 1} with agent ${agent}\n`);

    const res = await fetch(url, {
      method: 'get',
      headers: {
        DNT: '1',
        'User-Agent': agent,
        'Accept-Encoding': 'gzip, deflate',
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      },
      mode: 'no-cors',
      redirect: 'follow',
    });

    const f = path.join(p, uuid().split('-').at(-1)! + '.jpeg');
    const buffer = Buffer.from(await res.arrayBuffer());

    await writeFile(f, buffer, { mode: FILE_PERMISSION });
    await new Promise(resolve => setTimeout(resolve, 1000 * 2));
  } while(c-- > 0);
}
