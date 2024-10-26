export type MatrixArray = number[][];
export type ReadonlyMatrixArray = readonly (readonly number[])[];


export function isDimension(n: number): boolean {
  return typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n) && n >= 1;
}


export abstract class AbstractMatrix {
  public abstract readonly order: number;
  public abstract toArray(): ReadonlyMatrixArray;
  public abstract toMutableArray(): MatrixArray;
  public abstract get(row: number): number[] | null;
  public abstract get(row: number, col: number): number | null;
  public abstract set(row: number, col: number, value: number): boolean;
  public abstract setRow(row: number, data: number[]): boolean;
}
