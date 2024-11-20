export class BPlusTree {
  public root: unknown | null;

  public constructor( _rootNode?: unknown | null ) {
    this.root = _rootNode || null;
  }
}
