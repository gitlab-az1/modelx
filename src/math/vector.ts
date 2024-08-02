import math from './native';
import { Exception } from '../@internals/errors';


export type VectorConversionMethods = 
  | 'perspective_projection'
  | 'orthographic_projection';


export class Vector {
  #x: number;
  #y: number;
  #z: number;
  #freezed: boolean;

  /**
   * Creates a new Vector instance from a serialized string representation.
   * 
   * @param serialized - The serialized string to be parsed.
   * @returns A new Vector instance.
   * @throws Exception if the serialized string is invalid or if the vector plane is not 3D.
   */
  public static from(serialized: string): Vector {
    try {
      const obj = JSON.parse(serialized);

      if(obj.plane !== '3d') {
        throw new Exception('Vector plane is not 3D', 'ERR_INVALID_ARGUMENT');
      }

      return new Vector(obj.axis.x, obj.axis.y, obj.axis.z);
    } catch {
      throw new Exception('Invalid serialized vector', 'ERR_INVALID_ARGUMENT');
    }
  }

  /**
   * Create a new vector.
   * 
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   */
  public constructor(x: number, y: number, z: number) {
    [this.#x, this.#y, this.#z] = [x, y, z];
    this.#freezed = false;
  }

  /**
     * Axis X.
     */
  public get x(): number {
    return this.#x;
  }

  /**
     * Axis Y.
     */
  public get y(): number {
    return this.#y;
  }

  /**
   * Axis Z.
   */
  public get z(): number {
    return this.#z;
  }

  /**
   * Return true if the vector is freezed.
   */
  public get isFreezed(): boolean {
    return this.#freezed;
  }

  /**
   * Return the magnitude of the vector.
   * 
   * @returns 
   */
  public magnitude(): number {
    if (this.#freezed) {
      throw new Exception('Cannot get magnitude of a freezed vector', 'ERR_UNSUPPORTED_OPERATION');
    }

    return math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  /**
     * Return the normalized vector.
     * 
     * @returns 
     */
  public normalize(): Vector {
    if (this.#freezed) {
      throw new Exception('Cannot normalize a freezed vector', 'ERR_UNSUPPORTED_OPERATION');
    }

    const mag = this.magnitude();

    if(mag === 0) {
      throw new Exception('Cannot normalize a zero vector', 'ERR_UNSUPPORTED_OPERATION', {
        reason: 'division by zero',
      });
    }

    return new Vector(this.x / mag, this.y / mag, this.z / mag);
  }

  /**
     * Add a vector to the current one.
     * 
     * @param vec 
     * @returns 
     */
  public add(vec: Vector): Vector {
    if (this.#freezed) {
      throw new Exception('Cannot add a freezed vector', 'ERR_UNSUPPORTED_OPERATION');
    }

    return new Vector(this.x + vec.x, this.y + vec.y, this.z + vec.z);
  }

  /**
     * Subtract a vector from the current one.
     * 
     * @param vec 
     * @returns 
     */
  public subtract(vec: Vector): Vector {
    if (this.#freezed) {
      throw new Exception('Cannot subtract a freezed vector', 'ERR_UNSUPPORTED_OPERATION');
    }

    return new Vector(this.x - vec.x, this.y - vec.y, this.z - vec.z);
  }

  /**
     * Return the dot product of the current vector and the provided one.
     * 
     * @param vec 
     * @returns 
     */
  public dot(vec: Vector): number {
    if (this.#freezed) {
      throw new Exception('Cannot dot a freezed vector', 'ERR_UNSUPPORTED_OPERATION');
    }

    return this.x * vec.x + this.y * vec.y + this.z * vec.z;
  }

  /**
     * Return the cross product of the current vector and the provided one.
     * 
     * @param vec 
     * @returns 
     */
  public cross(vec: Vector): Vector {
    if (this.#freezed) {
      throw new Exception('Cannot cross a freezed vector', 'ERR_UNSUPPORTED_OPERATION');
    }

    return new Vector(this.y * vec.z - this.z * vec.y, this.z * vec.x - this.x * vec.z, this.x * vec.y - this.y * vec.x);
  }

  /**
     * Scale the current vector by the provided scalar.
     * 
     * @param scalar 
     * @returns 
     */
  public scale(scalar: number): Vector {
    if (this.#freezed) {
      throw new Exception('Cannot scale a freezed vector', 'ERR_UNSUPPORTED_OPERATION');
    }

    return new Vector(this.x * scalar, this.y * scalar, this.z * scalar);
  }

  /**
   * Freeze the current vector to prevent modifications.
   */
  public freeze(): void {
    this.#freezed = true;
  }

  /**
   * Serializes the Vector instance to a string representation.
   * 
   * @returns A serialized string representing the Vector.
   */
  public serialize(): string {
    return JSON.stringify({
      name: 'Vector',
      plane: '3d',
      axis: {
        x: this.x,
        y: this.y,
        z: this.z,
      },
    });
  
  }
}


export class Vector2D {
  #x: number;
  #y: number;
  #freezed: boolean;

  /**
   * Creates a new Vector2D instance from a serialized string representation.
   * 
   * @param serialized - The serialized string to be parsed.
   * @returns A new Vector2D instance.
   * @throws Exception if the serialized string is invalid or if the vector plane is not 2D.
   */
  public static from(serialized: string): Vector2D {
    try {
      const obj = JSON.parse(serialized);

      if(obj.plane !== '2d') {
        throw new Exception('Vector plane is not 2D', 'ERR_INVALID_ARGUMENT');
      }

      return new Vector2D(obj.axis.x, obj.axis.y);
    } catch {
      throw new Exception('Invalid serialized vector', 'ERR_INVALID_ARGUMENT');
    }
  }

  /**
   * Create a new 2D vector.
   * 
   * @param x 
   * @param y 
   */
  constructor(x: number, y: number) {
    this.#x = x;
    this.#y = y;
    this.#freezed = false;
  }

  /**
   * Axis X.
   */
  public get x(): number {
    return this.#x;
  }

  /**
   * Axis Y.
   */
  public get y(): number {
    return this.#y;
  }

  /**
   * Return true if the vector is freezed.
   */
  public get isFreezed(): boolean {
    return this.#freezed;
  }

  /**
   * Return the magnitude of the vector.
   * 
   * @returns 
   */
  public magnitude(): number {
    if (this.#freezed) {
      throw new Exception('Cannot get magnitude of a freezed vector', 'ERR_UNSUPPORTED_OPERATION');
    }

    return math.sqrt(this.x * this.x + this.y * this.y);
  }

  /**
   * Return the normalized vector.
   * 
   * @returns 
   */
  public normalize(): Vector2D {
    if (this.#freezed) {
      throw new Exception('Cannot normalize a freezed vector', 'ERR_UNSUPPORTED_OPERATION');
    }

    const mag = this.magnitude();
    return new Vector2D(this.x / mag, this.y / mag);
  }

  /**
   * Add a vector to the current one.
   * 
   * @param vec 
   * @returns 
   */
  public add(vec: Vector2D): Vector2D {
    if (this.#freezed) {
      throw new Exception('Cannot add a freezed vector', 'ERR_UNSUPPORTED_OPERATION');
    }

    return new Vector2D(this.x + vec.x, this.y + vec.y);
  }

  /**
   * Subtract a vector from the current one.
   * 
   * @param vec 
   * @returns 
   */
  public subtract(vec: Vector2D): Vector2D {
    if (this.#freezed) {
      throw new Exception('Cannot subtract a freezed vector', 'ERR_UNSUPPORTED_OPERATION');
    }

    return new Vector2D(this.x - vec.x, this.y - vec.y);
  }

  /**
   * Return the dot product of the current vector and the provided one.
   * 
   * @param vec 
   * @returns 
   */
  public dot(vec: Vector2D): number {
    if (this.#freezed) {
      throw new Exception('Cannot dot a freezed vector', 'ERR_UNSUPPORTED_OPERATION');
    }

    return this.x * vec.x + this.y * vec.y;
  }

  /**
   * Scale the current vector by the provided scalar.
   * 
   * @param scalar 
   * @returns 
   */
  public scale(scalar: number): Vector2D {
    if (this.#freezed) {
      throw new Exception('Cannot scale a freezed vector', 'ERR_UNSUPPORTED_OPERATION');
    }

    return new Vector2D(this.x * scalar, this.y * scalar);
  }

  /**
   * Freeze the current vector to prevent modifications.
   */
  public freeze(): void {
    this.#freezed = true;
  }

  /**
   * Serializes the Vector2D instance to a string representation.
   * 
   * @returns A serialized string representing the Vector2D.
   */
  public serialize(): string {
    return JSON.stringify({
      name: 'Vector2D',
      plane: '2d',
      axis: {
        x: this.x,
        y: this.y,
      },
    });
  }
}
