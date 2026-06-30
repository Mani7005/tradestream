import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { publishOrder, publishAudit } from "../kafka/client.js";
import { getOrderBook } from "../matchingEngine/orderBook.js";
import { SYMBOLS } from "../services/marketDataService.js";

const router = Router();

router.use(requireAuth);

const VALID_TYPES = ["LIMIT", "MARKET", "STOP_LOSS"];

router.post("/", rateLimit({ windowMs: 10_000, max: 15 }), async (req, res) => {
  const { symbol, side, quantity, price, stopPrice, orderType = "LIMIT" } = req.body;
  const userId = req.user.id;

  if (!symbol || !SYMBOLS.includes(symbol)) {
    return res.status(400).json({ error: `symbol must be one of ${SYMBOLS.join(", ")}` });
  }
  if (!["BUY", "SELL"].includes(side)) {
    return res.status(400).json({ error: "side must be BUY or SELL" });
  }
  if (!VALID_TYPES.includes(orderType)) {
    return res.status(400).json({ error: `orderType must be one of ${VALID_TYPES.join(", ")}` });
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ error: "quantity must be a positive integer" });
  }
  if (orderType === "LIMIT" && !(price > 0)) {
    return res.status(400).json({ error: "price is required for LIMIT orders" });
  }
  if (orderType === "STOP_LOSS" && !(stopPrice > 0)) {
    return res.status(400).json({ error: "stopPrice is required for STOP_LOSS orders" });
  }

  try {
    const insertRes = await pool.query(
      `INSERT INTO orders (user_id, symbol, side, order_type, price, stop_price, quantity, remaining_quantity, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8)
       RETURNING *`,
      [
        userId,
        symbol,
        side,
        orderType,
        orderType === "MARKET" ? null : price,
        orderType === "STOP_LOSS" ? stopPrice : null,
        quantity,
        orderType === "STOP_LOSS" ? "PENDING" : "OPEN",
      ]
    );
    const order = insertRes.rows[0];

    await publishOrder({
      id: order.id,
      userId,
      symbol,
      side,
      orderType,
      price: order.price ? Number(order.price) : null,
      stopPrice: order.stop_price ? Number(order.stop_price) : null,
      quantity,
      remainingQuantity: quantity,
    });
    await publishAudit("ORDER_PLACED", { orderId: order.id, userId, symbol, side, orderType, quantity, price });

    res.status(202).json({ order, message: "Order accepted and sent to the matching engine" });
  } catch (err) {
    console.error("[orders] place order error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", async (req, res) => {
  const { status } = req.query;
  const params = [req.user.id];
  let sql = `SELECT * FROM orders WHERE user_id = $1`;
  if (status) {
    sql += ` AND status = $2`;
    params.push(status);
  }
  sql += ` ORDER BY created_at DESC LIMIT 200`;
  const result = await pool.query(sql, params);
  res.json({ orders: result.rows });
});

router.delete("/:id", async (req, res) => {
  const orderId = Number(req.params.id);
  const result = await pool.query(`SELECT * FROM orders WHERE id = $1 AND user_id = $2`, [orderId, req.user.id]);
  const order = result.rows[0];
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (!["OPEN", "PARTIAL", "PENDING"].includes(order.status)) {
    return res.status(400).json({ error: `Cannot cancel order in status ${order.status}` });
  }

  const book = getOrderBook(order.symbol);
  book.cancelOrder(order.id, order.side);

  await pool.query(`UPDATE orders SET status = 'CANCELLED', updated_at = now() WHERE id = $1`, [orderId]);
  await publishAudit("ORDER_CANCELLED", { orderId, userId: req.user.id });

  res.json({ message: "Order cancelled" });
});

router.get("/book/:symbol", (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const book = getOrderBook(symbol);
  res.json(book.snapshot(20));
});

export default router;
