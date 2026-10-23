interface TrieNode {
  children: Map<string, TrieNode>;
  frequency: number;
  word: string;
  top: TrieNode[];
}
const makeNode = (): TrieNode => ({ children: new Map(), frequency: 0, word: '', top: [] });
const compare = (a: TrieNode, b: TrieNode): number =>
  b.frequency - a.frequency || a.word.localeCompare(b.word);
const CACHE_SIZE = 10;

export class Trie {
  private readonly root = makeNode();
  private _size = 0;
  get size(): number {
    return this._size;
  }
  insert(term: string, frequency = 1): void {
    if (!term || frequency <= 0) return;
    let node = this.root;
    const path = [node];
    for (const ch of term) {
      let child = node.children.get(ch);
      if (!child) {
        child = makeNode();
        node.children.set(ch, child);
      }
      node = child;
      path.push(node);
    }
    if (!node.frequency) {
      this._size++;
      node.word = term;
    }
    node.frequency += frequency;
    // Frequencies only increase: the changed terminal plus the cached winners
    // suffice. No untouched loser can newly outrank a winner.
    for (const prefix of path) {
      if (!prefix.top.includes(node)) prefix.top.push(node);
      prefix.top.sort(compare);
      prefix.top.length = Math.min(CACHE_SIZE, prefix.top.length);
    }
  }
  increment(term: string, delta = 1): void {
    if (this.findNode(term)?.frequency) this.insert(term, delta);
  }
  suggest(prefix: string, limit = 6): string[] {
    if (limit <= 0) return [];
    if (limit > CACHE_SIZE) return this.suggestUncached(prefix, limit);
    return (
      this.findNode(prefix)
        ?.top.slice(0, limit)
        .map((node) => node.word) ?? []
    );
  }
  /** Reference traversal retained for correctness tests and microbenchmarks. */
  suggestUncached(prefix: string, limit = 6): string[] {
    const node = this.findNode(prefix);
    if (!node || limit <= 0) return [];
    const entries: TrieNode[] = [];
    this.collect(node, entries);
    return entries
      .sort(compare)
      .slice(0, limit)
      .map((n) => n.word);
  }
  clear(): void {
    this.root.children.clear();
    this.root.top = [];
    this._size = 0;
  }
  toJSON(): Array<{ word: string; frequency: number }> {
    const entries: TrieNode[] = [];
    this.collect(this.root, entries);
    return entries.map(({ word, frequency }) => ({ word, frequency }));
  }
  static fromJSON(entries: Array<{ word: string; frequency: number }>): Trie {
    const trie = new Trie();
    for (const e of entries) trie.insert(e.word, e.frequency);
    return trie;
  }
  private findNode(prefix: string): TrieNode | undefined {
    let node: TrieNode | undefined = this.root;
    for (const ch of prefix) {
      node = node?.children.get(ch);
      if (!node) break;
    }
    return node;
  }
  private collect(node: TrieNode, entries: TrieNode[]): void {
    if (node.frequency) entries.push(node);
    for (const child of node.children.values()) this.collect(child, entries);
  }
}
