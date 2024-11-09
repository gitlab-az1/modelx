import type { LooseAutocomplete } from '../../types';


export type Feature<TProps extends object> = {
  name: string;
  check?: TProps extends any[] ? never : ({
    [K in keyof TProps]: {
      $equals?: any;
      $diff?: any;
    } | ((value: TProps[K]) => boolean)
  })[];
};

export type FeatureCheckConditions<TProps extends object> = TProps[keyof TProps] extends unknown[] ? never : {
  [K in keyof TProps]: {
    $equals?: TProps[K];
    $diff?: TProps[K];
  } | ((value: TProps[K]) => boolean);
}


export type FeaturesList = string[];

export type Resource<T extends object = any> = T;


export interface RuleManager {
  can<T extends object>(
    actions: string | string[],
    resource: LooseAutocomplete<'.*'>,
    conditions?: FeatureCheckConditions<T> // eslint-disable-line comma-dangle
  ): void;
  
  cannot<T extends object>(
    actions: string | string[],
    resource: LooseAutocomplete<'.*'>,
    conditions?: FeatureCheckConditions<T> // eslint-disable-line comma-dangle
  ): void;
}


class Rule implements RuleManager {
  private readonly _constraints: ({
    type: 'allow' | 'deny';
    resource?: LooseAutocomplete<'.*'>;
    actions?: string | string[];
    conditions?: FeatureCheckConditions<any>;
  })[] = [];

  public constructor(private readonly _name: string) { }

  public get name(): string {
    return this._name;
  }

  public can<T extends object>(actions: string | string[], resource: LooseAutocomplete<'.*'>, conditions?: FeatureCheckConditions<T>): void {
    this._constraints.push({ actions, conditions, resource, type: 'allow' });
  }

  public cannot<T extends object>(actions: string | string[], resource: LooseAutocomplete<'.*'>, conditions?: FeatureCheckConditions<T>): void {
    this._constraints.push({ actions, conditions, resource, type: 'deny' });
  }
}


export function createRule(name: string, createConstrants?: (manager: RuleManager) => void): Rule {
  const rule = new Rule(name);

  const can = <T extends object>(actions: string | string[], resource: LooseAutocomplete<'.*'>, conditions?: FeatureCheckConditions<T>) => {
    rule.can(actions, resource, conditions);
  };

  const cannot = <T extends object>(actions: string | string[], resource: LooseAutocomplete<'.*'>, conditions?: FeatureCheckConditions<T>) => {
    rule.cannot(actions, resource, conditions);
  };

  createConstrants?.({ can, cannot });
  return rule;
}
