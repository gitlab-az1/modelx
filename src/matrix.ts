import { abs } from './math/native';
import { assert } from './@internals/util';
import { setLastError } from './environment';
import { Exception } from './@internals/errors';


export class Matrix {
  readonly #rows: number;
  readonly #cols: number;
  #data: number[][];

  public static fromIterator(data: Iterable<number | number[]>): Matrix {
    try {
      const matrixData: number[][] = [];
      let isFirstRowArray = false;

      for(const item of data) {
        if(typeof item === 'number') {
          if(isFirstRowArray) {
            throw new Exception('Invalid data format: mixed types in iterable.', 'ERR_INVALID_ARGUMENT');
          }

          if(matrixData.length === 0) {
            matrixData.push([]);
          }

          matrixData[0].push(item);
        } else if(Array.isArray(item)) {
          if(matrixData.length === 0) {
            isFirstRowArray = true;
          } else if(!isFirstRowArray) {
            throw new Exception('Invalid data format: mixed types in iterable.', 'ERR_INVALID_ARGUMENT');
          }

          matrixData.push(item);
        } else {
          throw new Exception('Invalid data format: expected number or number[].', 'ERR_INVALID_ARGUMENT');
        }
      }

      const rows = matrixData.length;
      const cols = isFirstRowArray ? matrixData[0].length : matrixData[0].length;

      const matrix = new Matrix(rows, cols);

      for(let i = 0; i < rows; i++) {
        for(let j = 0; j < cols; j++) {
          matrix.set(i, j, matrixData[i][j]);
        }
      }

      return matrix;
    } catch (e: any) {
      setLastError(e);
      throw e;
    }
  }

  public constructor(
    _rows: number,
    _cols: number,
    _fill?: (i: number, j: number, o: number, r: number, c: number) => number,
  ) {
    try {
      _assertPositive(_rows);
      _assertPositive(_cols);

      this.#rows = _rows;
      this.#cols = _cols;

      this.#data = new Array(_rows);

      for(let i = 0; i < _rows; i++) {
        this.#data[i] = new Array(_cols).fill(0);
      }
    
      if(!!_fill && typeof _fill === 'function') {
        for(let i = 0; i < _rows; i++) {
          for(let j = 0; j < _cols; j++) {
            const result = _fill(i, j, this.order, _rows, _cols);
            assert(typeof result === 'number');
          
            this.#data[i][j] = result;
          }
        }
      }
    } catch (e: any) {
      setLastError(e);
      throw e;
    }
  }

  public get order(): number {
    return this.#rows === this.#cols ? this.#rows : -1;
  }

  public get rows(): number {
    return this.#rows;
  }

  public get cols(): number {
    return this.#cols;
  }

  public get isSquare(): boolean {
    return this.order > -1;
  }

  public get size(): number {
    return this.#rows * this.#cols;
  }

  public mul(t: number, o?: 'inner'): void;
  public mul(t: number, o: 'outer'): Matrix;
  public mul(t: Matrix, o?: 'outer'): Matrix;
  public mul(t: number | Matrix, o: 'inner' | 'outer' = 'inner'): void | Matrix {
    try {
      if(!['inner', 'outer'].includes(o)) {
        o = 'inner';
      }
  
      let result: Matrix | void = void 0;
  
      if(typeof t === 'number') {
        const out = o === 'outer' ? new Matrix(this.#rows, this.#cols) : null;
  
        for(let i = 0; i < this.#rows; i++) {
          for(let j = 0; j < this.#cols; j++) {
            if(o === 'outer') {
              out?.set(i, j, this.#data[i][j] * t);
            } else {
              this.#data[i][j] *= t;
            }
          }
        }
  
        if(out != null) {
          result = out;
        }
      } else {
        if(!(t instanceof Matrix)) {
          throw new Exception(`Cannot multiply a matrix by 'typeof ${typeof t}'`, 'ERR_INVALID_ARGUMENT');
        }
  
        if(this.#cols !== t.rows) {
          throw new Exception('Matrix multiplication dimensions do not match', 'ERR_INVALID_ARGUMENT');
        }
  
        result = new Matrix(this.#rows, t.cols);
  
        for(let i = 0; i < this.#rows; i++) {
          for(let j = 0; j < t.cols; j++) {
            let sum = 0;
  
            for(let k = 0; k < this.#cols; k++) {
              sum += this.#data[i][k] * t.get(k, j);
            }
  
            result.set(i, j, sum);
          }
        }
      }
  
      return result;
    } catch (e: any) {
      setLastError(e);
      throw e;
    }
  }

  public transpose(): void {
    try {
      const result = new Matrix(this.#cols, this.#rows);

      for(let i = 0; i < this.#rows; i++) {
        for(let j = 0; j < this.#cols; j++) {
          result.set(j, i, this.#data[i][j]);
        }
      }

      this.#data = null!;
      this.#data = result.#data;
      result.#data = null!;
    } catch (e: any) {
      setLastError(e);
      throw e;
    }
  }

  public toTransposed(): Matrix {
    try {
      const result = new Matrix(this.#cols, this.#rows);

      for(let i = 0; i < this.#rows; i++) {
        for(let j = 0; j < this.#cols; j++) {
          result.set(j, i, this.#data[i][j]);
        }
      }

      return result;
    } catch (e: any) {
      setLastError(e);
      throw e;
    }
  }

  public add(other: Matrix): this {
    try {
      if(this.#rows !== other.rows || this.#cols !== other.cols) {
        throw new Exception('Matrix addition dimensions do not match', 'ERR_INVALID_ARGUMENT');
      }
  
      for(let i = 0; i < this.#rows; i++) {
        for(let j = 0; j < this.#cols; j++) {
          this.#data[i][j] += other.get(i, j);
        }
      }
  
      return this;
    } catch (e: any) {
      setLastError(e);
      throw e;
    }
  }

  public toAdded(other: Matrix): Matrix {
    try {
      if(this.#rows !== other.rows || this.#cols !== other.cols) {
        throw new Exception('Matrix addition dimensions do not match', 'ERR_INVALID_ARGUMENT');
      }

      const result = new Matrix(this.#rows, this.#cols);

      for(let i = 0; i < this.#rows; i++) {
        for(let j = 0; j < this.#cols; j++) {
          result.set(i, j, this.#data[i][j] + other.get(i, j));
        }
      }

      return result;
    } catch (e: any) {
      setLastError(e);
      throw e;
    }
  }

  public subtract(other: Matrix): this {
    try {
      if(this.#rows !== other.rows || this.#cols !== other.cols) {
        throw new Exception('Matrix addition dimensions do not match', 'ERR_INVALID_ARGUMENT');
      }
  
      for(let i = 0; i < this.#rows; i++) {
        for(let j = 0; j < this.#cols; j++) {
          this.#data[i][j] -= other.get(i, j);
        }
      }
  
      return this;
    } catch (e: any) {
      setLastError(e);
      throw e;
    }
  }

  public toSubtracted(other: Matrix): Matrix {
    try {
      if(this.#rows !== other.rows || this.#cols !== other.cols) {
        throw new Exception('Matrix addition dimensions do not match', 'ERR_INVALID_ARGUMENT');
      }
  
      const result = new Matrix(this.#rows, this.#cols);
  
      for(let i = 0; i < this.#rows; i++) {
        for(let j = 0; j < this.#cols; j++) {
          result.set(i, j, this.#data[i][j] - other.get(i, j));
        }
      }
  
      return result;
    } catch (e: any) {
      setLastError(e);
      throw e;
    }
  }

  public equals(other: Matrix): boolean {
    try {
      if(this.#rows !== other.rows || this.#cols !== other.cols) return false;
      let result = true;

      for(let i = 0; i < this.#rows; i++) {
        if(!result) break;

        for(let j = 0; j < this.#cols; j++) {
          if(this.#data[i][j] === other.get(i, j)) continue;

          result = false;
          break;
        }
      }

      return result;
    } catch (e: any) {
      setLastError(e);
      throw e;
    }
  }

  public isNull(): boolean {
    try {
      let result = true;

      for(let i = 0; i < this.#rows; i++) {
        if(!result) break;

        for(let j = 0; j < this.#cols; j++) {
          if(this.#data[i][j] === 0) continue;

          result = false;
          break;
        }
      }

      return result;
    } catch (e: any) {
      setLastError(e);
      throw e;
    }
  }

  public neg(): this {
    try {
      for(let i = 0; i < this.#rows; i++) {
        for(let j = 0; j < this.#cols; j++) {
          if(abs(this.#data[i][j]) === 0) {
            this.#data[i][j] = 0;
          } else {
            this.#data[i][j] = -this.#data[i][j];
          }
        }
      }
  
      return this; 
    } catch (e: any) {
      setLastError(e);
      throw e;
    }
  }

  public set(i: number, j: number, value: number): this {
    try {
      _assertPositive(i);
      _assertPositive(j);
      assert(typeof value === 'number');

      if(i > this.#rows) {
        throw new Exception(`Cannot access position ${i} of matrix(${this.order})`, 'ERR_OUT_OF_BOUNDS');
      }

      if(j > this.#rows) {
        throw new Exception(`Cannot access position ${i}.${j} of matrix(${this.order})`, 'ERR_OUT_OF_BOUNDS');
      }

      this.#data[i][j] = value;
      return this;
    } catch (e: any) {
      setLastError(e);
      throw e;
    }
  }

  public get(row: number): readonly number[];
  public get(row: number, col: number): number;
  public get(row: number, col?: number): number | readonly number[] {
    try {
      _assertPositive(row);

      // eslint-disable-next-line no-extra-boolean-cast
      if(!!col) {
        _assertPositive(col);
      }

      if(typeof col !== 'number') return Object.freeze([ ...this.#data[row] ]);
      return this.#data[row][col]; 
    } catch (e: any) {
      setLastError(e);
      throw e;
    }
  }

  public toArray(): readonly (readonly number[])[] {
    try {
      return Object.freeze([ ...this.#data ].map(Object.freeze)) as readonly number[][];
    } catch (e: any) {
      setLastError(e);
      throw e;
    }
  }

  public toString(): string {
    try {
      return (this.#data.map(row => row.join('\t')).join('\n') + '\n');
    } catch (e: any) {
      setLastError(e);
      throw e;
    }
  }
}


export class SquareMatrix extends Matrix {
  public static override fromIterator(data: Iterable<number | number[]>): SquareMatrix {
    try {
      const matrixData: number[][] = [];
      let isFirstRowArray = false;

      for(const item of data) {
        if(typeof item === 'number') {
          if(isFirstRowArray) {
            throw new Exception('Invalid data format: mixed types in iterable.', 'ERR_INVALID_ARGUMENT');
          }

          if(matrixData.length === 0) {
            matrixData.push([]);
          }

          matrixData[0].push(item);
        } else if(Array.isArray(item)) {
          if(matrixData.length === 0) {
            isFirstRowArray = true;
          } else if(!isFirstRowArray) {
            throw new Exception('Invalid data format: mixed types in iterable.', 'ERR_INVALID_ARGUMENT');
          }

          matrixData.push(item);
        } else {
          throw new Exception('Invalid data format: expected number or number[].', 'ERR_INVALID_ARGUMENT');
        }
      }

      const rows = matrixData.length;
      const cols = isFirstRowArray ? matrixData[0].length : matrixData[0].length;

      if(rows !== cols) {
        throw new Exception('Invalid data: SquareMatrix requires a square shape (order x order).', 'ERR_INVALID_ARGUMENT');
      }

      const squareMatrix = new SquareMatrix(rows);

      for(let i = 0; i < rows; i++) {
        for(let j = 0; j < cols; j++) {
          squareMatrix.set(i, j, matrixData[i][j]);
        }
      }

      return squareMatrix;
    } catch (e: any) {
      setLastError(e);
      throw e;
    }
  }

  public constructor(
    _order: number,
    _fill?: (i: number, j: number, o: number, r: number, c: number) => number,
  ) {
    super(_order, _order, _fill);
  }

  #Determinant(): number {
    try {
      if(super.order === 1) return super.get(0, 0);
      let det = 0;

      for(let j = 0; j < super.order; j++) {
        det += (j % 2 === 0 ? 1 : -1) * super.get(0, j) * this.#Cofactor(0, j).#Determinant();
      }

      return det;
    } catch (e: any) {
      setLastError(e);
      throw e;
    }
  }

  #Cofactor(row: number, col: number): SquareMatrix {
    try {
      const subMatrix = new SquareMatrix(this.order - 1);
      let subRow = 0, subCol = 0;

      for(let i = 0; i < super.order; i++) {
        if(i === row) continue;
        subCol = 0;

        for(let j = 0; j < super.order; j++) {
          if(j === col) continue;

          subMatrix.set(subRow, subCol, super.get(i, j));
          subCol++;
        }

        subRow++;
      }

      return subMatrix;
    } catch (e: any) {
      setLastError(e);
      throw e;
    }
  }

  public determinant(): number {
    return this.#Determinant();
  }

  public isInvertible(): boolean {
    return this.#Determinant() !== 0;
  }

  public inverse(): this {
    try {
      if(!(this.#Determinant() !== 0)) {
        throw new Exception('Matrix is not invertible', 'ERR_UNSUPPORTED_OPERATION');
      }
  
      const det = this.#Determinant();
      let adjugate = new SquareMatrix(super.order);
  
      for(let i = 0; i < super.order; i++) {
        for(let j = 0; j < super.order; j++) {
          const cofactorMatrix = this.#Cofactor(i, j);
          const cofactorDet = cofactorMatrix.#Determinant();
  
          adjugate.set(j, i, ((i + j) % 2 === 0 ? 1 : -1) * cofactorDet);
        }
      }
  
      adjugate.mul(1 / det, 'inner');
  
      for(let i = 0; i < super.rows; i++) {
        for(let j = 0; j < super.cols; j++) {
          super.set(i, j, adjugate.get(i, j));
        }
      }
  
      adjugate = null!;
      return this;
    } catch (e: any) {
      setLastError(e);
      throw e;
    }
  }

  public toInversed(): SquareMatrix {
    try {
      if(!(this.#Determinant() !== 0)) {
        throw new Exception('Matrix is not invertible', 'ERR_UNSUPPORTED_OPERATION');
      }
  
      const det = this.#Determinant();
      const adjugate = new SquareMatrix(super.order);
  
      for(let i = 0; i < super.order; i++) {
        for(let j = 0; j < super.order; j++) {
          const cofactorMatrix = this.#Cofactor(i, j);
          const cofactorDet = cofactorMatrix.#Determinant();
  
          adjugate.set(j, i, ((i + j) % 2 === 0 ? 1 : -1) * cofactorDet);
        }
      }
  
      adjugate.mul(1 / det, 'inner');
      return adjugate;
    } catch (e: any) {
      setLastError(e);
      throw e;
    }
  }

  public trace(): number {
    try {
      let trace = 0;

      for(let i = 0; i < super.order; i++) {
        trace += super.get(i, i);
      }
    
      return trace;
    } catch (e: any) {
      setLastError(e);
      throw e;
    }
  }
}

export class IdentityMatrix extends SquareMatrix {
  public constructor(_order: number) {
    super(_order, (i, j) => i === j ? 1 : 0);
  }
}


function _assertPositive(input: unknown, msg?: string): asserts input is number {
  assert(typeof input === 'number' && Number.isInteger(input) && input >= 0, msg);
}
