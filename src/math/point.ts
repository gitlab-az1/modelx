import { Exception } from '../@internals/errors';
import { Vector, Vector2D, type VectorConversionMethods } from './vector';


export type PointFromVectorOptions = {
  conversionMethod?: VectorConversionMethods;
  projectionPlaneZ?: number;
  focalLength?: number;
}


/**
 * Represents a 2D point in a coordinate system.
 */
export class Point {

  /**
   * Create a new point from a vector.
   * 
   * __Methods to translate a 3D vector to a 2D point:__
   * 
   * - `Perspective projection`: The most common method to convert a 3D vector to a 2D point by isolating the Z axis and using the focal length and the projection plane Z. The axis X and Y are scaled by the focal length divided by the sum of the projection plane Z and the vector Z.
   * - `Orthographic projection`: A method to convert a 3D vector to a 2D point using an orthographic projection.
   * 
   * @param {Vector|Vector2D} vec - The input vector (either 2D or 3D).
   * @param {PointFromVectorOptions} options - Options for the conversion process.
   * @returns {Point} A new Point instance representing the 2D point.
   */
  public static fromVector(vec: Vector | Vector2D, options?: PointFromVectorOptions): Point {
    let p: Point = new Point(-1, -1);
    // vec.freeze();

    if(vec instanceof Vector2D) {
      p = new Point(vec.x, vec.y);
    } else if(vec instanceof Vector) {
      if(!options?.conversionMethod) {
        if(typeof vec.z === 'number' && vec.z > 0) {
          throw new Exception('Cannot convert 3D vector to 2D point', 'ERR_INVALID_ARGUMENT');
        }
  
        p = new Point(vec.x, vec.y);
      } else {
        if(vec.z === 0) {
          throw new Exception('Cannot convert 3D vector to 2D point', 'ERR_INVALID_ARGUMENT');
        }

        switch(options.conversionMethod || 'orthographic_projection') {
          case 'orthographic_projection':
            p = new Point(vec.x, vec.y);
            break;
          case 'perspective_projection': {
            const focalLength = options.focalLength ?? 1.0;
            const projectionPlaneZ = options.projectionPlaneZ ?? 1.0;

            const scale = focalLength / (projectionPlaneZ + vec.z);
            p = new Point(vec.x * scale, vec.y * scale);
            break;
          }
        }
      }
    }

    return p;
  }


  #x: number;
  #y: number;
  #freezed: boolean;

  /**
   * Constructor for the Point class.
   * 
   * @param {number} x - The X-coordinate of the point.
   * @param {number} y - The Y-coordinate of the point.
   */
  public constructor(x: number, y: number) {
    [this.#x, this.#y] = [x, y];
    this.#freezed = false;
  }

  /**
   * Get the X-coordinate of the point.
   * 
   * @returns {number} - The X-coordinate.
   */
  public get x(): number {
    return this.#x;
  }

  /**
   * Get the Y-coordinate of the point.
   * 
   * @returns {number} - The Y-coordinate.
   */
  public get y(): number {
    return this.#y;
  }

  /**
   * Add another point to this point.
   * 
   * @param {Point} point - The point to add.
   * @returns {Point} - A new Point instance representing the result of the addition.
   * @throws {Exception} - If the current point is frozen.
   */
  public add(point: Point): Point {
    if(this.#freezed) {
      throw new Exception('Cannot add to frozen point', 'ERR_UNSUPPORTED_OPERATION');
    }

    return new Point(this.x + point.x, this.y + point.y);
  }

  /**
   * Subtract another point from this point.
   * 
   * @param {Point} point - The point to subtract.
   * @returns {Point} - A new Point instance representing the result of the subtraction.
   * @throws {Exception} - If the current point is frozen.
   */
  public subtract(point: Point): Point {
    if(this.#freezed) {
      throw new Exception('Cannot subtract from frozen point', 'ERR_UNSUPPORTED_OPERATION');
    }

    return new Point(this.x - point.x, this.y - point.y);
  }

  /**
   * Scale the point by a scalar value.
   * 
   * @param {number} scalar - The scalar value to multiply the coordinates by.
   * @returns {Point} - A new Point instance representing the scaled point.
   * @throws {Exception} - If the current point is frozen.
   */
  public scale(scalar: number): Point {
    if(this.#freezed) {
      throw new Exception('Cannot scale frozen point', 'ERR_UNSUPPORTED_OPERATION');
    }

    return new Point(this.x * scalar, this.y * scalar);
  }

  /**
   * Freeze the point, preventing further modifications.
   */
  public freeze(): void {
    this.#freezed = true;
  }
}

export default Point;
