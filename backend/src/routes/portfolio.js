import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { getPortfolio } from "../services/portfolioService.js";
import { getLatestPrice } from "../redisClient.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const { user, positions } = await getPortfolio(pool, req.user.id);

  const enriched = await Promise.all(
    positions.map(async (p) => {
      const price = Number((await getLatestPrice(p.symbol)) || p.average_price);
      const marketValue = price * p.shares;
      const costBasis = Number(p.average_price) * p.shares;
      return {
        ...p,
        currentPrice: price,
        marketValue,
        unrealizedPnl: marketValue - costBasis,
        unrealizedPnlPct: costBasis > 0 ? ((marketValue - costBasis) / costBasis) * 100 : 0,
      };
    })
  );

  const totalMarketValue = enriched.reduce((sum, p) => sum + p.marketValue, 0);
  const netWorth = Number(user.balance) + totalMarketValue;

  res.json({ user, positions: enriched, totalMarketValue, netWorth });
});

router.get("/trades", async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM trades WHERE buyer_id = $1 OR seller_id = $1 ORDER BY executed_at DESC LIMIT 200`,
    [req.user.id]
  );
  res.json({ trades: result.rows });
});

export default router;
