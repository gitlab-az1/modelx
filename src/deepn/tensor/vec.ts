import math from 'next-math';

import { Exception } from '../../@internals/errors';


export interface TensorVector {
  readonly dimensions: number;
}

export interface KnownPointsVector extends TensorVector {
  readonly x: number;
  readonly y: number;
  readonly z?: number;
}

export interface MultidimensionalVector extends TensorVector {
  readonly points: readonly number[];
}


export class Vector2D implements KnownPointsVector {
  readonly #points: [number, number];
  #frozen: boolean;

  public constructor(x: number, y: number) {
    this.#points = [x, y];
    this.#frozen = false;
  }

  public get dimensions(): number {
    return 2;
  }

  public get x(): number {
    return this.#points[0];
  }

  public get y(): number {
    return this.#points[1];
  }

  /** sqrt (x ^ 2 + y ^ 2) */
  public magnitude(): number {
    return math.sqrt(this.#points[0] ** 2 + this.#points[1] ** 2);
  }

  public normalize(): this {
    if(this.#frozen) {
      throw new Exception('Cannot normalize a frozen vector', 'ERR_AVOID_MODIFICATION');
    }

    const mag = math.sqrt(this.#points[0] ** 2 + this.#points[1] ** 2);

    if(math.abs(mag) === 0) {
      throw new Exception(`Cannot normalize a vector with magnitude ${mag}: avoid division by zero`, 'ERR_UNSUPPORTED_OPERATION');
    }

    this.#points[0] /= mag;
    this.#points[1] /= mag;

    return this;
  }

  public toNormalized(): Vector2D {
    const mag = math.sqrt(this.#points[0] ** 2 + this.#points[1] ** 2);

    if(math.abs(mag) === 0) {
      throw new Exception(`Cannot normalize a vector with magnitude ${mag}: avoid division by zero`, 'ERR_UNSUPPORTED_OPERATION');
    }

    return new Vector2D(this.#points[0] / mag, this.#points[1] / mag);
  }

  public add(other: Vector2D | number): this {
    if(this.#frozen) {
      throw new Exception('Cannot add a frozen vector', 'ERR_AVOID_MODIFICATION');
    }

    if(typeof other === 'number') {
      this.#points[0] += other;
      this.#points[1] += other;
    } else if(other instanceof Vector2D) {
      this.#points[0] += other.#points[0];
      this.#points[1] += other.#points[1];
    } else {
      throw new Exception('You can only call `add` from an vector with numbers or ohter vector with the same dimension', 'ERR_INVALID_ARGUMENT');
    }

    return this;
  }

  public toAdded(other: Vector2D | number): Vector2D {
    let x = 0, y = 0;

    if(typeof other === 'number') {
      x = this.#points[0] + other;
      y = this.#points[1] + other;
    } else if(other instanceof Vector2D) {
      x = this.#points[0] + other.#points[0];
      y = this.#points[1] + other.#points[1];
    } else {
      throw new Exception('You can only call `add` from an vector with numbers or ohter vector with the same dimension', 'ERR_INVALID_ARGUMENT');
    }

    return new Vector2D(x, y);
  }

  public subtract(other: Vector2D | number): this {
    if(this.#frozen) {
      throw new Exception('Cannot subtract a frozen vector', 'ERR_AVOID_MODIFICATION');
    }

    if(typeof other === 'number') {
      this.#points[0] -= other;
      this.#points[1] -= other;
    } else if(other instanceof Vector2D) {
      this.#points[0] -= other.#points[0];
      this.#points[1] -= other.#points[1];
    } else {
      throw new Exception('You can only call `subtract` from an vector with numbers or ohter vector with the same dimension', 'ERR_INVALID_ARGUMENT');
    }

    return this;
  }

  public toSubtracted(other: Vector2D | number): Vector2D {
    let x = 0, y = 0;

    if(typeof other === 'number') {
      x = this.#points[0] - other;
      y = this.#points[1] - other;
    } else if(other instanceof Vector2D) {
      x = this.#points[0] - other.#points[0];
      y = this.#points[1] - other.#points[1];
    } else {
      throw new Exception('You can only call `toSubtracted` from an vector with numbers or ohter vector with the same dimension', 'ERR_INVALID_ARGUMENT');
    }

    return new Vector2D(x, y);
  }

  public dot(other: Vector2D): number {
    if(!(other instanceof Vector2D)) {
      throw new Exception('You can only calculate the dot product of an vector with ohter vector with the same dimension', 'ERR_INVALID_ARGUMENT');
    }

    return this.#points[0] * other.#points[0] + this.#points[1] * other.#points[1];
  }

  public scale(factor: number): this {
    if(this.#frozen) {
      throw new Exception('Cannot scale a frozen vector', 'ERR_AVOID_MODIFICATION');
    }

    this.#points[0] *= factor;
    this.#points[1] *= factor;

    return this;
  }

  public toScaled(factor: number): Vector2D {
    return new Vector2D(this.#points[0] * factor, this.#points[1] * factor);
  }

  public freeze(): this {
    if(this.#frozen) return this;

    this.#frozen = true;
    return this;
  }

  public toArray(): [number, number] {
    return [ ...this.#points ];
  }
}

export class Vector3D implements KnownPointsVector {
  readonly #points: [number, number, number];
  #frozen: boolean;

  public constructor(x: number, y: number, z: number) {
    this.#points = [x, y, z];
    this.#frozen = false;
  }

  public get dimensions(): number {
    return 3;
  }

  public get x(): number {
    return this.#points[0];
  }

  public get y(): number {
    return this.#points[1];
  }

  public get z(): number {
    return this.#points[2];
  }

  public magnitude(): number {
    return math.sqrt(this.#points[0] ** 2 + this.#points[1] ** 2 + this.#points[2] ** 2);
  }

  public normalize(): this {
    if(this.#frozen) {
      throw new Exception('Cannot normalize a frozen vector', 'ERR_AVOID_MODIFICATION');
    }

    const mag = this.magnitude();

    if(math.abs(mag) === 0) {
      throw new Exception(`Cannot normalize a vector with magnitude ${mag}: avoid division by zero`, 'ERR_UNSUPPORTED_OPERATION');
    }

    this.#points[0] /= mag;
    this.#points[1] /= mag;
    this.#points[2] /= mag;

    return this;
  }

  public toNormalized(): Vector3D {
    const mag = this.magnitude();

    if(math.abs(mag) === 0) {
      throw new Exception(`Cannot normalize a vector with magnitude ${mag}: avoid division by zero`, 'ERR_UNSUPPORTED_OPERATION');
    }

    return new Vector3D(this.#points[0] / mag, this.#points[1] / mag, this.#points[2] / mag);
  }

  public add(other: Vector3D | number): this {
    if(this.#frozen) {
      throw new Exception('Cannot add a frozen vector', 'ERR_AVOID_MODIFICATION');
    }

    if(typeof other === 'number') {
      this.#points[0] += other;
      this.#points[1] += other;
      this.#points[2] += other;
    } else if(other instanceof Vector3D) {
      this.#points[0] += other.#points[0];
      this.#points[1] += other.#points[1];
      this.#points[2] += other.#points[2];
    } else {
      throw new Exception('You can only call `add` from a vector with numbers or another vector with the same dimension', 'ERR_INVALID_ARGUMENT');
    }

    return this;
  }

  public toAdded(other: Vector3D | number): Vector3D {
    let x = 0, y = 0, z = 0;

    if(typeof other === 'number') {
      x = this.#points[0] + other;
      y = this.#points[1] + other;
      z = this.#points[2] + other;
    } else if(other instanceof Vector3D) {
      x = this.#points[0] + other.#points[0];
      y = this.#points[1] + other.#points[1];
      z = this.#points[2] + other.#points[2];
    } else {
      throw new Exception('You can only call `add` from a vector with numbers or another vector with the same dimension', 'ERR_INVALID_ARGUMENT');
    }

    return new Vector3D(x, y, z);
  }

  public subtract(other: Vector3D | number): this {
    if(this.#frozen) {
      throw new Exception('Cannot subtract a frozen vector', 'ERR_AVOID_MODIFICATION');
    }

    if(typeof other === 'number') {
      this.#points[0] -= other;
      this.#points[1] -= other;
      this.#points[2] -= other;
    } else if(other instanceof Vector3D) {
      this.#points[0] -= other.#points[0];
      this.#points[1] -= other.#points[1];
      this.#points[2] -= other.#points[2];
    } else {
      throw new Exception('You can only call `subtract` from a vector with numbers or another vector with the same dimension', 'ERR_INVALID_ARGUMENT');
    }

    return this;
  }

  public toSubtracted(other: Vector3D | number): Vector3D {
    let x = 0, y = 0, z = 0;

    if(typeof other === 'number') {
      x = this.#points[0] - other;
      y = this.#points[1] - other;
      z = this.#points[2] - other;
    } else if(other instanceof Vector3D) {
      x = this.#points[0] - other.#points[0];
      y = this.#points[1] - other.#points[1];
      z = this.#points[2] - other.#points[2];
    } else {
      throw new Exception('You can only call `toSubtracted` from a vector with numbers or another vector with the same dimension', 'ERR_INVALID_ARGUMENT');
    }

    return new Vector3D(x, y, z);
  }

  public dot(other: Vector3D): number {
    if(!(other instanceof Vector3D)) {
      throw new Exception('You can only calculate the dot product of a vector with another vector with the same dimension', 'ERR_INVALID_ARGUMENT');
    }

    return this.#points[0] * other.#points[0] + this.#points[1] * other.#points[1] + this.#points[2] * other.#points[2];
  }

  public cross(other: Vector3D): this {
    if(this.#frozen) {
      throw new Exception('Cannot cross a frozen vector', 'ERR_AVOID_MODIFICATION');
    }

    if(!(other instanceof Vector3D)) {
      throw new Exception('You can only calculate the cross product with another 3D vector', 'ERR_INVALID_ARGUMENT');
    }

    const x = this.#points[1] * other.#points[2] - this.#points[2] * other.#points[1];
    const y = this.#points[2] * other.#points[0] - this.#points[0] * other.#points[2];
    const z = this.#points[0] * other.#points[1] - this.#points[1] * other.#points[0];

    this.#points[0] = x;
    this.#points[1] = y;
    this.#points[2] = z;

    return this;
  }

  public toCrossed(other: Vector3D): Vector3D {
    if(!(other instanceof Vector3D)) {
      throw new Exception('You can only calculate the cross product with another 3D vector', 'ERR_INVALID_ARGUMENT');
    }

    const x = this.#points[1] * other.#points[2] - this.#points[2] * other.#points[1];
    const y = this.#points[2] * other.#points[0] - this.#points[0] * other.#points[2];
    const z = this.#points[0] * other.#points[1] - this.#points[1] * other.#points[0];

    return new Vector3D(x, y, z);
  }

  public scale(factor: number): this {
    if(this.#frozen) {
      throw new Exception('Cannot scale a frozen vector', 'ERR_AVOID_MODIFICATION');
    }

    this.#points[0] *= factor;
    this.#points[1] *= factor;
    this.#points[2] *= factor;

    return this;
  }

  public toScaled(factor: number): Vector3D {
    return new Vector3D(this.#points[0] * factor, this.#points[1] * factor, this.#points[2] * factor);
  }

  public freeze(): this {
    if(this.#frozen) return this;

    this.#frozen = true;
    return this;
  }

  public toArray(): [number, number, number] {
    return [ ...this.#points ];
  }
}

export class Vector implements MultidimensionalVector {
  readonly #points: number[];
  #frozen: boolean;

  public constructor(points: readonly number[]) {
    this.#points = [...points];
    this.#frozen = false;
  }

  public get dimensions(): number {
    return this.#points.length;
  }

  public get points(): readonly number[] {
    return this.#points;
  }

  public magnitude(): number {
    return math.sqrt(this.#points.reduce((sum, val) => sum + val ** 2, 0));
  }

  public normalize(): this {
    if(this.#frozen) {
      throw new Exception('Cannot normalize a frozen vector', 'ERR_AVOID_MODIFICATION');
    }

    const mag = this.magnitude();

    if(math.abs(mag) === 0) {
      throw new Exception(`Cannot normalize a vector with magnitude ${mag}: avoid division by zero`, 'ERR_UNSUPPORTED_OPERATION');
    }

    this.#points.forEach((_, idx) => this.#points[idx] /= mag);

    return this;
  }

  public toNormalized(): Vector {
    const mag = this.magnitude();

    if(math.abs(mag) === 0) {
      throw new Exception(`Cannot normalize a vector with magnitude ${mag}: avoid division by zero`, 'ERR_UNSUPPORTED_OPERATION');
    }

    const normalizedPoints = this.#points.map(val => val / mag);

    return new Vector(normalizedPoints);
  }

  public add(other: Vector | number): this {
    if(this.#frozen) {
      throw new Exception('Cannot add a frozen vector', 'ERR_AVOID_MODIFICATION');
    }

    if(typeof other === 'number') {
      this.#points.forEach((_, idx) => this.#points[idx] += other);
    } else if(other instanceof Vector && other.dimensions === this.dimensions) {
      this.#points.forEach((_, idx) => this.#points[idx] += other.#points[idx]);
    } else {
      throw new Exception('You can only add a vector with the same dimension or a number to this vector', 'ERR_INVALID_ARGUMENT');
    }

    return this;
  }

  public toAdded(other: Vector | number): Vector {
    let points = this.#points.slice();

    if(typeof other === 'number') {
      points = points.map(val => val + other);
    } else if(other instanceof Vector && other.dimensions === this.dimensions) {
      points = points.map((val, idx) => val + other.#points[idx]);
    } else {
      throw new Exception('You can only add a vector with the same dimension or a number to this vector', 'ERR_INVALID_ARGUMENT');
    }

    return new Vector(points);
  }

  public subtract(other: Vector | number): this {
    if(this.#frozen) {
      throw new Exception('Cannot subtract from a frozen vector', 'ERR_AVOID_MODIFICATION');
    }

    if(typeof other === 'number') {
      this.#points.forEach((_, idx) => this.#points[idx] -= other);
    } else if(other instanceof Vector && other.dimensions === this.dimensions) {
      this.#points.forEach((_, idx) => this.#points[idx] -= other.#points[idx]);
    } else {
      throw new Exception('You can only subtract a vector with the same dimension or a number from this vector', 'ERR_INVALID_ARGUMENT');
    }

    return this;
  }

  public toSubtracted(other: Vector | number): Vector {
    let points = this.#points.slice();

    if(typeof other === 'number') {
      points = points.map(val => val - other);
    } else if(other instanceof Vector && other.dimensions === this.dimensions) {
      points = points.map((val, idx) => val - other.#points[idx]);
    } else {
      throw new Exception('You can only subtract a vector with the same dimension or a number from this vector', 'ERR_INVALID_ARGUMENT');
    }

    return new Vector(points);
  }

  public dot(other: Vector): number {
    if(other instanceof Vector && other.dimensions === this.dimensions) {
      return this.#points.reduce((sum, val, idx) => sum + val * other.#points[idx], 0);
    }

    throw new Exception('Dot product can only be computed with another vector of the same dimension', 'ERR_INVALID_ARGUMENT');
  }

  public scale(factor: number): this {
    if(this.#frozen) {
      throw new Exception('Cannot scale a frozen vector', 'ERR_AVOID_MODIFICATION');
    }

    this.#points.forEach((_, idx) => this.#points[idx] *= factor);

    return this;
  }

  public toScaled(factor: number): Vector {
    return new Vector(this.#points.map(val => val * factor));
  }

  public freeze(): this {
    if(this.#frozen) return this;

    this.#frozen = true;
    return this;
  }

  public toArray(): number[] {
    return [ ...this.#points ];
  }
}
