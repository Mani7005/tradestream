import { createConsumer, TOPICS, publishTrade, publishAudit } from "./client.js";
import { MatchingEngine } from "../matchingEngine/matchingEngine.js";
import { pool } from "../db.js";
import { applyTradeToPortfolios } from "../services/portfolioService.js";

/**
 * Starts the consumer group that owns the matching engine. In a real exchange this would
 * be sharded by symbol; here a single consumer instance processes the `orders` topic
 * in order, which is sufficient for a simulator and keeps matching deterministic.
 */
export async function startMatchingConsumer(io) {
  const consumer = createConsumer("matching-engine-group");
  await consumer.connect();
  await consumer.subscribe({ topic: TOPICS.ORDERS, fromBeginning: false });

  const engine = new MatchingEngine({
    onTrade: async (trade) => {
      const result = await pool.query(
        `INSERT INTO trades (symbol, buy_order_id, sell_order_id, buyer_id, seller_id, price, quantity)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [trade.symbol, trade.buyOrderId, trade.sellOrderId, trade.buyerId, trade.sellerId, trade.price, trade.quantity]
      );
      const savedTrade = result.rows[0];

      await applyTradeToPortfolios(trade);
      await publishTrade(trade);
      await publishAudit("TRADE_EXECUTED", trade);

      io.to(`symbol:${trade.symbol}`).emit("trade", savedTrade);
      io.to(`user:${trade.buyerId}`).emit("portfolio:update", { reason: "trade" });
      io.to(`user:${trade.sellerId}`).emit("portfolio:update", { reason: "trade" });
    },
    onBookUpdate: async (symbol, snapshot) => {
      io.to(`symbol:${symbol}`).emit("orderbook:update", snapshot);
    },
    onOrderUpdate: async (patch) => {
      await pool.query(
        `UPDATE orders SET status = $1, remaining_quantity = $2, updated_at = now() WHERE id = $3`,
        [patch.status, patch.remainingQuantity, patch.id]
      );
      io.emit("order:update", patch);
    },
  });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const order = JSON.parse(message.value.toString());
        await engine.processOrder(order);
      } catch (err) {
        console.error("[matching-engine] failed to process order:", err);
      }
    },
  });

  console.log("[kafka] matching engine consumer running");
  return consumer;
}
