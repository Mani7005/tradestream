/**
 * Generic binary heap.
 * `compare(a, b)` should return a negative number if `a` has higher priority than `b`.
 *
 * For the BUY side we want a MAX-HEAP on price (highest price = highest priority),
 * with FIFO (time priority) as a tiebreaker -> compare(a, b) = b.price - a.price, then a.seq - b.seq.
 *
 * For the SELL side we want a MIN-HEAP on price (lowest price = highest priority),
 * with FIFO as a tiebreaker -> compare(a, b) = a.price - b.price, then a.seq - b.seq.
 */
export class Heap {
  constructor(compare) {
    this.compare = compare;
    this.items = [];
  }

  size() {
    return this.items.length;
  }

  isEmpty() {
    return this.items.length === 0;
  }

  peek() {
    return this.items[0] ?? null;
  }

  push(item) {
    this.items.push(item);
    this._bubbleUp(this.items.length - 1);
  }

  pop() {
    if (this.items.length === 0) return null;
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0) {
      this.items[0] = last;
      this._bubbleDown(0);
    }
    return top;
  }

  /** Remove a specific item (by predicate) e.g. when a resting order is cancelled. */
  remove(predicate) {
    const idx = this.items.findIndex(predicate);
    if (idx === -1) return null;
    const removed = this.items[idx];
    const last = this.items.pop();
    if (idx < this.items.length) {
      this.items[idx] = last;
      this._bubbleDown(idx);
      this._bubbleUp(idx);
    }
    return removed;
  }

  toSortedArray() {
    return [...this.items].sort(this.compare);
  }

  _bubbleUp(index) {
    let i = index;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.compare(this.items[i], this.items[parent]) < 0) {
        [this.items[i], this.items[parent]] = [this.items[parent], this.items[i]];
        i = parent;
      } else break;
    }
  }

  _bubbleDown(index) {
    let i = index;
    const n = this.items.length;
    while (true) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let smallest = i;
      if (left < n && this.compare(this.items[left], this.items[smallest]) < 0) smallest = left;
      if (right < n && this.compare(this.items[right], this.items[smallest]) < 0) smallest = right;
      if (smallest === i) break;
      [this.items[i], this.items[smallest]] = [this.items[smallest], this.items[i]];
      i = smallest;
    }
  }
}

export function makeBuyHeap() {
  // Max-heap by price, FIFO tiebreak
  return new Heap((a, b) => (b.price - a.price) || (a.seq - b.seq));
}

export function makeSellHeap() {
  // Min-heap by price, FIFO tiebreak
  return new Heap((a, b) => (a.price - b.price) || (a.seq - b.seq));
}
