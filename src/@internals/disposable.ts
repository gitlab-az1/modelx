export interface IDisposable {
  dispose(): void;
}


export function toDisposable(dispose: () => void): IDisposable {
  return { dispose };
}

export function isDisposable(arg: unknown): arg is IDisposable {
  return !!arg && typeof arg === 'object' && typeof (<IDisposable>arg).dispose === 'function';
}
