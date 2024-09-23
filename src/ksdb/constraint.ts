export type PresetCheck = (
  | 'int'
  | 'decimal'
  | 'datetime'
  | 'text'
  | 'bool'
  | 'array'
  | {
    type: 'text';
    maxLength?: number;
    minLength?: number;
  }
  | {
    type: 'int';
    max?: number;
    min?: number;
  }
  | {
    type: 'decimal';
    max?: number;
    min?: number;
  }
  | {
    type: 'datetime';
    max?: Date | string | number;
    min?: Date | string | number;
  }
  | {
    type: 'array';
    items: PresetCheck;
    length?: number;
  }
);

export type ConstraintInit = (
  | { type: 'unique'; }
  | { type: 'not-null' }
  | {
    type: 'check';
    check: PresetCheck | ((value: any) => boolean);
  }
)
