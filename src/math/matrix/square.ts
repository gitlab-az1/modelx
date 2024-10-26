import { AbstractMatrix, type MatrixArray, type ReadonlyMatrixArray } from './core';


const $matrixData = Symbol('MATRIX::INTERNAL_DESCRIPTOR::SQUARE_MATRIX.Bucket');
const $order = Symbol('MATRIX::INTERNAL_DESCRIPTOR::SQUARE_MATRIX.Order');


export class Identity extends AbstractMatrix {
  private readonly [$matrixData]: number[][];
  private readonly [$order]: number;

  public constructor(n: number) {
    super();
    
    this[$order] = n;
    this[$matrixData] = new Array(n);

    for(let i = 0; i < n; i++) {
      this[$matrixData][i] = new Array(n);

      for(let j = 0; j < n; j++) {
        this[$matrixData][i][j] = i === j ? 1 : 0;
      }
    }
  }

  public get order(): number {
    return this[$order];
  }

  public get(row: number): number[] | null;
  public get(row: number, col: number): number | null;
  public get(row: number, col?: number): number[] | number | null {
    if(row < 0 || row > this[$order]) return null;
    if(!col) return [ ...this[$matrixData][row] ];
    return this[$matrixData][row][col] || null;
  }

  public set(i: number, j: number, n: number): boolean {
    if(i < 0 || i > this[$order]) return false;
    if(j < 0 || j > this[$order]) return false;

    if(n === this[$matrixData][i][j]) return true;
    return false;
  }

  public setRow(i: number, r: number[]): boolean {
    if(i < 0 || i > this[$order]) return false;

    for(let j = 0; j < this[$order]; j++) {
      if(this[$matrixData][i][j] !== r[j]) return false;
    }

    return true;
  }

  public toArray(): ReadonlyMatrixArray {
    return Object.freeze([ ...this[$matrixData] ].map(current => Object.freeze([ ...current ]) )) as ReadonlyMatrixArray;
  }

  public toMutableArray(): MatrixArray {
    return [ ...this[$matrixData] ].map(current => [ ...current ]);
  }
}
