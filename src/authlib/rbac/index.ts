export * from './rules';
import { createRule } from './rules';


export type Rule = ReturnType<typeof createRule>;
