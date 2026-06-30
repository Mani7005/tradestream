import { Router } from "express";
import { pool } from "../db.js";
import { getLatestPrice } from "../redisClient.js";
import { SYMBOLS } from "../services/marketDataService.js";

const router = Router();

router.get("/symbols", async (_req, res) => {
  const prices = await Promise.all(
    SYMBOLS.map(async (symbol) => ({ symbol, price: Number(await getLatestPrice(symbol)) }))
  );
  res.json({ symbols: prices });
});

router.get("/price/:symbol", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const price = await getLatestPrice(symbol);
  if (!price) return res.status(404).json({ error: "Unknown symbol" });
  res.json({ symbol, price: Number(price) });
});

/**
 * Candlestick aggregation (advanced feature) — buckets executed trades into OHLCV
 * candles directly from the trades table, on a configurable interval.
 */
router.get("/candles/:symbol", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const intervalMinutes = Math.max(1, Number(req.query.intervalMinutes) || 5);

  const result = await pool.query(
    `
    SELECT
      to_timestamp(floor(extract(epoch from executed_at) / ($2 * 60)) * ($2 * 60)) AS bucket,
      (array_agg(price ORDER BY executed_at ASC))[1] AS open,
      max(price) AS high,
      min(price) AS low,
      (array_agg(price ORDER BY executed_at DESC))[1] AS close,
      sum(quantity) AS volume
    FROM trades
    WHERE symbol = $1
    GROUP BY bucket
    ORDER BY bucket ASC
    LIMIT 500
    `,
    [symbol, intervalMinutes]
  );

  res.json({ symbol, intervalMinutes, candles: result.rows });
});

export default router;
