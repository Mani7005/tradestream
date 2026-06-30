import { makeBuyHeap, makeSellHeap } from "./heap.js";

let globalSeq = 0;
function nextSeq() {
  globalSeq += 1;
  return globalSeq;
}

/**
 * OrderBook holds resting (unfilled or partially filled) LIMIT orders for one symbol,
 * split into a buy max-heap and a sell min-heap, exactly how a real exchange book works.
 */
export class OrderBook {
  constructor(symbol) {
    this.symbol = symbol;
    this.buyHeap = makeBuyHeap();
    this.sellHeap = makeSellHeap();
    // Track stop orders that haven't triggered yet.
    this.stopOrders = []; // { id, side, stopPrice, order }
  }

  bestBid() {
    return this.buyHeap.peek();
  }

  bestAsk() {
    return this.sellHeap.peek();
  }

  spread() {
    const bid = this.bestBid();
    const ask = this.bestAsk();
    if (!bid || !ask) return null;
    return ask.price - bid.price;
  }

  addRestingOrder(order) {
    const entry = {
      id: order.id,
      userId: order.userId,
      price: Number(order.price),
      quantity: order.remainingQuantity,
      seq: nextSeq(),
    };
    if (order.side === "BUY") this.buyHeap.push(entry);
    else this.sellHeap.push(entry);
    return entry;
  }

  cancelOrder(orderId, side) {
    const heap = side === "BUY" ? this.buyHeap : this.sellHeap;
    return heap.remove((item) => item.id === orderId);
  }

  /** Returns a plain-object depth snapshot, e.g. for WebSocket broadcast / REST responses. */
  snapshot(depth = 10) {
    const aggregate = (arr) => {
      const map = new Map();
      for (const o of arr) {
        map.set(o.price, (map.get(o.price) || 0) + o.quantity);
      }
      return [...map.entries()]
        .map(([price, quantity]) => ({ price, quantity }))
        .slice(0, depth);
    };

    const bids = aggregate(this.buyHeap.toSortedArray()).sort((a, b) => b.price - a.price);
    const asks = aggregate(this.sellHeap.toSortedArray()).sort((a, b) => a.price - b.price);

    return { symbol: this.symbol, bids, asks, timestamp: Date.now() };
  }
}

export const orderBooks = new Map();

export function getOrderBook(symbol) {
  if (!orderBooks.has(symbol)) {
    orderBooks.set(symbol, new OrderBook(symbol));
  }
  return orderBooks.get(symbol);
}
