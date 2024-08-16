import type { Dict } from '../../../@internals/types';


export const genderMapping = Object.freeze({
  male: -1,
  female: 1,
  'non-binary': 0,
} as const);


export const ageGroupMapping = Object.freeze({
  baby: -1,
  child: -0.6,
  teen: -0.2,
  young: 0.2,
  adult: 0.6,
  older: 1,
  senior: 1,
} as const);


export const hairColorMapping = Object.freeze({
  black: -1,
  brown: -0.6,
  blonde: -0.2,
  red: 0.2,
  gray: 0.6,
  white: 1,
  other: 0,
} as const);


export const hairStyleMapping = Object.freeze({
  short: -1,
  medium: -0.5,
  long: 0,
  curly: 0.5,
  bald: 1,
} as const);


export const eyesColorMapping = Object.freeze({
  blue: -1,
  green: -0.6,
  brown: -0.2,
  hazel: 0.2,
  gray: 0.6,
  amber: 1,
  other: 0,
});


export const skinColorMapping = Object.freeze({
  'very-light': -1,
  light: -0.6,
  medium: 0,
  tan: 0.3,
  dark: 0.6,
  'very-dark': 1,
} as const);


export const raceMapping = Object.freeze({
  white: -1,
  black: -0.6,
  asian: -0.2,
  hispanic: 0.2,
  'middle-eastern': 0.6,
  'native-american': 1,
  mixed: 0.4,
  other: 0,
} as const);



export function toRange<T extends Dict<number>>(mapping: T, exclude?: (keyof T)[]): readonly number[] {
  let values = new Set<number>();

  if(!exclude || !Array.isArray(exclude)) {
    values = null!;
    values = new Set(Object.values(mapping));
  } else {
    for(const k of Object.keys(mapping).filter(item => !exclude.includes(item))) {
      values.add(mapping[k]);
    }
  }

  return Object.freeze( [...values].sort((a, b) => a - b) );
  // return Object.freeze( [ ...( new Set(Object.values(mapping)) ) ].sort((a, b) => a - b) );
}
