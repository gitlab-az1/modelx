export class Car {
  public constructor(
    public x: number,
    public y: number,
    public width: number,
    public height: number // eslint-disable-line comma-dangle
  ) { }

  public draw(context: CanvasRenderingContext2D): void {
    context.beginPath();

    context.rect(this.x - this.width / 2,
      this.y - this.height / 2,
      this.width,
      this.height);

    context.fill();
  }
}

export default Car;
