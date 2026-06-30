import { getOrderBook } from "./orderBook.js";
import { getLatestPrice, setLatestPrice, cacheOrderBookSnapshot } from "../redisClient.js";

/**
 * MatchingEngine consumes incoming orders (from Kafka) and matches them against the
 * resting order book using price-time priority, exactly how a real exchange works:
 *
 *   - BUY orders rest in a max-heap keyed on price (highest price = best bid)
 *   - SELL orders rest in a min-heap keyed on price (lowest price = best ask)
 *   - A trade executes whenever bestBid.price >= bestAsk.price
 *   - The execution price is the RESTING order's price (price-time priority: the order
 *     that was already in the book "sets" the price, matching real exchange behavior)
 *   - Partial fills are supported: the larger order's remainder stays in the book
 */
export class MatchingEngine {
  constructor({ onTrade, onBookUpdate, onOrderUpdate }) {
    this.onTrade = onTrade; // async (trade) => {}
    this.onBookUpdate = onBookUpdate; // async (symbol, snapshot) => {}
    this.onOrderUpdate = onOrderUpdate; // async (orderPatch) => {}
  }

  async processOrder(order) {
    // order: { id, userId, symbol, side, orderType, price, stopPrice, quantity, remainingQuantity }
    const book = getOrderBook(order.symbol);

    if (order.orderType === "STOP_LOSS") {
      book.stopOrders.push({ order });
      return { triggeredTrades: [] };
    }

    if (order.orderType === "MARKET") {
      // Market orders take whatever price is on the opposite side of the book.
      // If the book is empty, fall back to last known price (or reject).
      const oppositeBest = order.side === "BUY" ? book.bestAsk() : book.bestBid();
      if (!oppositeBest) {
        const lastPrice = await getLatestPrice(order.symbol);
        if (!lastPrice) {
          // No liquidity and no reference price: cannot fill a market order.
          await this.onOrderUpdate({ id: order.id, status: "CANCELLED", remainingQuantity: order.remainingQuantity });
          return { triggeredTrades: [] };
        }
        order.price = Number(lastPrice);
      } else {
        order.price = oppositeBest.price;
      }
    }

    const trades = await this._match(order, book);

    // Whatever remains (limit orders, or market orders if liquidity ran out) rests in the book.
    if (order.remainingQuantity > 0 && order.orderType !== "MARKET") {
      book.addRestingOrder(order);
    }

    const snapshot = book.snapshot();
    await cacheOrderBookSnapshot(order.symbol, snapshot);
    await this.onBookUpdate(order.symbol, snapshot);

    if (trades.length > 0) {
      const lastTradePrice = trades[trades.length - 1].price;
      await setLatestPrice(order.symbol, lastTradePrice);
      await this._checkStopOrders(book, lastTradePrice);
    }

    return { triggeredTrades: trades };
  }

  async _match(incomingOrder, book) {
    const trades = [];
    const isBuy = incomingOrder.side === "BUY";
    const oppositeHeap = isBuy ? book.sellHeap : book.buyHeap;

    while (incomingOrder.remainingQuantity > 0 && !oppositeHeap.isEmpty()) {
      const resting = oppositeHeap.peek();

      const crosses = isBuy
        ? incomingOrder.price >= resting.price || incomingOrder.orderType === "MARKET"
        : incomingOrder.price <= resting.price || incomingOrder.orderType === "MARKET";

      if (!crosses) break;

      const fillQty = Math.min(incomingOrder.remainingQuantity, resting.quantity);
      const executionPrice = resting.price; // resting order sets the price

      const trade = {
        symbol: incomingOrder.symbol,
        price: executionPrice,
        quantity: fillQty,
        buyOrderId: isBuy ? incomingOrder.id : resting.id,
        sellOrderId: isBuy ? resting.id : incomingOrder.id,
        buyerId: isBuy ? incomingOrder.userId : resting.userId,
        sellerId: isBuy ? resting.userId : incomingOrder.userId,
      };
      trades.push(trade);

      incomingOrder.remainingQuantity -= fillQty;
      resting.quantity -= fillQty;

      if (resting.quantity === 0) {
        oppositeHeap.pop();
        await this.onOrderUpdate({ id: resting.id, status: "FILLED", remainingQuantity: 0 });
      } else {
        // Mutate heap top in place then re-heapify down since quantity shrank
        // (price didn't change so heap order is still valid).
        await this.onOrderUpdate({ id: resting.id, status: "PARTIAL", remainingQuantity: resting.quantity });
      }

      await this.onTrade(trade);
    }

    const incomingStatus =
      incomingOrder.remainingQuantity === 0
        ? "FILLED"
        : incomingOrder.remainingQuantity < incomingOrder.quantity
        ? "PARTIAL"
        : "OPEN";

    await this.onOrderUpdate({
      id: incomingOrder.id,
      status: incomingOrder.orderType === "MARKET" && incomingOrder.remainingQuantity > 0 ? "CANCELLED" : incomingStatus,
      remainingQuantity: incomingOrder.remainingQuantity,
    });

    return trades;
  }

  /** Stop-loss orders convert into market orders once the trade price crosses the trigger. */
  async _checkStopOrders(book, lastPrice) {
    const stillWaiting = [];
    for (const entry of book.stopOrders) {
      const { order } = entry;
      const triggered =
        (order.side === "SELL" && lastPrice <= order.stopPrice) ||
        (order.side === "BUY" && lastPrice >= order.stopPrice);

      if (triggered) {
        const marketOrder = { ...order, orderType: "MARKET" };
        await this.processOrder(marketOrder);
      } else {
        stillWaiting.push(entry);
      }
    }
    book.stopOrders = stillWaiting;
  }
}
