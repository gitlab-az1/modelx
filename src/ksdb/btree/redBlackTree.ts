const RED = 0;
const BLACK = 1;


class Node<T> {
  public constructor(
    public content: T,
    public color: number = RED,
    public left: Node<T> | null = null,
    public right: Node<T> | null = null,
    public parent: Node<T> | null = null // eslint-disable-line comma-dangle
  ) { }

  public getColor(): 'red' | 'black' {
    return this.color === BLACK ? 'black' : 'red';
  }

  public get isRed(): boolean {
    return this.color === RED;
  }
}

export class RedBlackTree<T> {
  readonly #TNULL: Node<T>;
  public root: Node<T>;

  public constructor( _rootNode?: Node<T> ) {
    this.#TNULL = new Node(null as unknown as T, BLACK);
    this.root = _rootNode || this.#TNULL;
  }

  public get TNULL(): Node<T> {
    return this.#TNULL;
  }
}


export type Comparator<T> = (a: T, b: T) => number;

export const defaultCompare: Comparator<string | number> = Object.freeze(function(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
});


export function leftRotate<T>(tree: RedBlackTree<T>, x: Node<T>): void {
  const y = x.right!;
  x.right = y.left;

  if(y.left !== tree.TNULL) {
    y.left!.parent = x;
  }

  y.parent = x.parent;

  if(x.parent === null) {
    tree.root = y;
  } else if(x === x.parent.left) {
    x.parent.left = y;
  } else {
    x.parent.right = y;
  }

  y.left = x;
  x.parent = y;
}

export function rightRotate<T>(tree: RedBlackTree<T>, x: Node<T>): void {
  const y = x.left!;
  x.left = y.right;

  if(y.right !== tree.TNULL) {
    y.right!.parent = x;
  }

  y.parent = x.parent;

  if(x.parent === null) {
    tree.root = y;
  } else if(x === x.parent.right) {
    x.parent.right = y;
  } else {
    x.parent.left = y;
  }

  y.right = x;
  x.parent = y;
}

/**
 * Fixes Red-Black Tree properties after insertion.
 * 
 * @param tree - The Red-Black Tree.
 * @param k - The node to fix.
 */
export function balanceAfterInsertion<T>(tree: RedBlackTree<T>, k: Node<T>): void {
  while(k.parent?.color === RED) {
    if(k.parent === k.parent.parent?.left) {
      const u = k.parent.parent.right;

      if(u?.color === RED) {
        k.parent.color = BLACK;
        u.color = BLACK;
        k.parent.parent.color = RED;
        k = k.parent.parent;
      } else {
        if(k === k.parent.right) {
          k = k.parent;
          leftRotate(tree, k);
        }

        k.parent!.color = BLACK;
        k.parent!.parent!.color = RED;

        rightRotate(tree, k.parent!.parent!);
      }
    } else {
      const u = k.parent.parent?.left;

      if(u?.color === RED) {
        k.parent.color = BLACK;
        u.color = BLACK;
        k.parent.parent!.color = RED;
        k = k.parent.parent!;
      } else {
        if(k === k.parent.left) {
          k = k.parent;
          rightRotate(tree, k);
        }

        k.parent!.color = BLACK;
        k.parent!.parent!.color = RED;

        leftRotate(tree, k.parent!.parent!);
      }
    }
  }

  tree.root.color = BLACK;
}

/**
 * Insert a new node in the Red-Black Tree or update their value if the key already exists.
 * 
 * @param tree The Red-Black Tree.
 * @param data The value to insert or update.
 * @param comparator Optional comparator function to compare node values.
 */
export function upsert<T>(
  tree: RedBlackTree<T>,
  data: T,
  comparator: Comparator<T> = defaultCompare as Comparator<T> // eslint-disable-line comma-dangle
): void {
  const newNode = new Node<T>(data);
  newNode.left = tree.TNULL;
  newNode.right = tree.TNULL;

  let y: Node<T> | null = null;
  let x: Node<T> | null = tree.root;

  while(x !== tree.TNULL) {
    y = x;
    const comparison = comparator(newNode.content, x!.content);

    if(comparison === 0) {
      x!.content = data;
    }

    x = comparison < 0 ? x!.left! : x!.right!;
  }

  newNode.parent = y;

  if(y === null) {
    tree.root = newNode;
  } else if(comparator(newNode.content, y.content) < 0) {
    y.left = newNode;
  } else {
    y.right = newNode;
  }

  if(newNode.parent === null) {
    newNode.color = BLACK;
    return;
  }

  if(newNode.parent.parent === null) return;
  balanceAfterInsertion(tree, newNode);
}

/**
 * Finds a node in the Red-Black Tree by its content.
 * 
 * @param tree The Red-Black Tree to search in.
 * @param value The value to look up.
 * @param comparator Optional comparator function to compare node values.
 * @returns The node containing the value, or null if not found.
 */
export function lookup<T>(
  tree: RedBlackTree<T>,
  value: T,
  comparator: Comparator<T> = defaultCompare as Comparator<T> // eslint-disable-line comma-dangle
): Node<T> | null {
  let current = tree.root;

  while(current !== tree.TNULL) {
    const comparison = comparator(value, current.content);
    if(comparison === 0) return current;

    // Traverse left or right subtree based on comparison
    current = comparison < 0 ? current.left! : current.right!;
  }

  return null;
}

/**
 * Deletes a node with the specified value from the Red-Black Tree.
 * 
 * @param tree The Red-Black Tree.
 * @param value The value to delete.
 * @param comparator Optional comparator function to compare node values.
 */
export function deleteNode<T>(
  tree: RedBlackTree<T>,
  value: T,
  comparator: Comparator<T> = defaultCompare as Comparator<T> // eslint-disable-line comma-dangle
): void {
  let nodeToDelete = tree.root;

  while(nodeToDelete !== tree.TNULL) {
    const comparison = comparator(value, nodeToDelete.content);
    if(comparison === 0) break;

    nodeToDelete = comparison < 0 ? nodeToDelete.left! : nodeToDelete.right!;
  }

  if(nodeToDelete === tree.TNULL) return;

  let y = nodeToDelete;
  let originalColor = y.color;
  let x: Node<T>;

  if(nodeToDelete.left === tree.TNULL) {
    x = nodeToDelete.right!;
    transplant(tree, nodeToDelete, nodeToDelete.right!);
  } else if(nodeToDelete.right === tree.TNULL) {
    x = nodeToDelete.left!;
    transplant(tree, nodeToDelete, nodeToDelete.left!);
  } else {
    y = minimum(nodeToDelete.right!, tree);

    originalColor = y.color;
    x = y.right!;

    if(y.parent === nodeToDelete) {
      x.parent = y;
    } else {
      transplant(tree, y, y.right!);

      y.right = nodeToDelete.right;
      y.right!.parent = y;
    }

    transplant(tree, nodeToDelete, y);

    y.left = nodeToDelete.left;
    y.left!.parent = y;
    y.color = nodeToDelete.color;
  }

  if(originalColor === BLACK) {
    balanceAfterDeletion(tree, x);
  }
}

/**
 * Fixes Red-Black Tree properties after deletion.
 * 
 * @param tree - The Red-Black Tree.
 * @param x - The node to fix.
 */
export function balanceAfterDeletion<T>(tree: RedBlackTree<T>, x: Node<T>): void {
  while(x !== tree.root && x.color === BLACK) {
    if(x === x.parent!.left) {
      let sibling = x.parent!.right!;

      if(sibling.color === RED) {
        sibling.color = BLACK;
        x.parent!.color = RED;

        leftRotate(tree, x.parent!);
        sibling = x.parent!.right!;
      }

      if(sibling.left!.color === BLACK && sibling.right!.color === BLACK) {
        sibling.color = RED;
        x = x.parent!;
      } else {
        if(sibling.right!.color === BLACK) {
          sibling.left!.color = BLACK;
          sibling.color = RED;

          rightRotate(tree, sibling);
          sibling = x.parent!.right!;
        }

        sibling.color = x.parent!.color;
        x.parent!.color = BLACK;
        sibling.right!.color = BLACK;

        leftRotate(tree, x.parent!);
        x = tree.root!;
      }
    } else {
      let sibling = x.parent!.left!;

      if(sibling.color === RED) {
        sibling.color = BLACK;
        x.parent!.color = RED;

        rightRotate(tree, x.parent!);
        sibling = x.parent!.left!;
      }

      if(sibling.right!.color === BLACK && sibling.left!.color === BLACK) {
        sibling.color = RED;
        x = x.parent!;
      } else {
        if(sibling.left!.color === BLACK) {
          sibling.right!.color = BLACK;
          sibling.color = RED;

          leftRotate(tree, sibling);
          sibling = x.parent!.left!;
        }

        sibling.color = x.parent!.color;
        x.parent!.color = BLACK;
        sibling.left!.color = BLACK;

        rightRotate(tree, x.parent!);
        x = tree.root!;
      }
    }
  }

  x.color = BLACK;
}

/**
 * Replaces one subtree as a child of its parent with another subtree.
 * 
 * @param tree - The Red-Black Tree.
 * @param u - The node to be replaced.
 * @param v - The replacement node.
 */
export function transplant<T>(tree: RedBlackTree<T>, u: Node<T>, v: Node<T>): void {
  if(u.parent === null) {
    tree.root = v;
  } else if(u === u.parent.left) {
    u.parent.left = v;
  } else {
    u.parent.right = v;
  }

  v.parent = u.parent;
}

/**
 * Finds the node with the minimum value in a subtree.
 * 
 * @param node - The subtree's root.
 * @param tree - The Red-Black Tree.
 * @returns The node with the minimum value.
 */
export function minimum<T>(node: Node<T>, tree: RedBlackTree<T>): Node<T> {
  while(node.left !== tree.TNULL) {
    node = node.left!;
  }

  return node;
}

/**
 * In-order traversal array with values of each node in the tree.
 * 
 * @param tree The tree to transverse
 * @returns An iterator with all the values in the tree
 */
export function* transverse<T>(tree: RedBlackTree<T>, node = tree.root): Generator<T> {
  if(node !== tree.TNULL) {
    yield* transverse<T>(tree, node.left!);
    yield node.content;
    yield* transverse(tree, node.right!);
  }
}
