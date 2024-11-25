import { SyncMetric } from './_metric';
import Span, { type SpanOptions } from './span';
import Counter, { type CounterOptions } from './counter';


const metrics: SyncMetric[] = [];



export function createCounter(name: string, options?: CounterOptions): Counter {
  const c = new Counter(name, options);
  metrics.push(c);

  return c;
}

export function startSpan<T>(name: string, options?: SpanOptions<T>): Span<T> {
  const s = new Span<T>(name, options);
  metrics.push(s);

  return s;
}
