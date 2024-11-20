import fs from 'fs';
import * as jpeg from 'jpeg-js';

import { max } from '../../math/native';
import { readBinary } from '../../fs';


export type ImageDecodeOptions = {
  useTArray?: boolean;
  colorTransform?: boolean;
  formatAsRGBA?: boolean;
  tolerantDecoding?: boolean;
  maxResolutionInMP?: number;
  maxMemoryUsageInMB?: number;
};

export class JPEGImageProcessor {
  public static async from(path: string | URL, mask?: Uint8Array, options?: ImageDecodeOptions): Promise<JPEGImageProcessor> {
    const buffer = await (mask ? readBinary(path, mask) : fs.promises.readFile(path));
    return new JPEGImageProcessor(buffer, options);
  }
  
  readonly #img: jpeg.RawImageData<Buffer> & { comments?: any[] };

  public constructor(raw: Uint8Array, options?: ImageDecodeOptions) {
    this.#img = jpeg.decode(raw, options as never) as any;

    if(!Buffer.isBuffer(this.#img.data)) {
      this.#img.data = Buffer.from(this.#img.data);
    }
  }

  public get processorType(): 'jpeg' {
    return 'jpeg' as const;
  }

  public grayScale(): readonly number[] {
    const grayscaleData = [];

    for(let i = 0; i < this.#img.width * this.#img.height * 4; i += 4) {
      const r = this.#img.data[i];
      const g = this.#img.data[i + 1];
      const b = this.#img.data[i + 2];

      grayscaleData.push(0.299 * r + 0.587 * g + 0.114 * b);
    }

    return Object.freeze(grayscaleData);
  }

  public normalize(): readonly number[] {
    const m = max(...this.#img.data);
    return Object.freeze(Array.from(this.#img.data).map(x => x / m));
  }
}

export default JPEGImageProcessor;
