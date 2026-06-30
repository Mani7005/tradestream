import { withTransaction } from "../db.js";

/**
 * Applies one executed trade to both sides' cash balances and positions.
 * Recomputes weighted-average cost basis for the buyer; realizes P&L implicitly
 * for the seller by reducing their share count (FIFO/avg-cost simplification).
 */
export async function applyTradeToPortfolios(trade) {
  const { buyerId, sellerId, symbol, price, quantity } = trade;
  const cost = Number(price) * quantity;

  await withTransaction(async (client) => {
    // Buyer: cash decreases, position increases (weighted average price)
    await client.query(`UPDATE users SET balance = balance - $1 WHERE id = $2`, [cost, buyerId]);

    const buyerPos = await client.query(
      `SELECT shares, average_price FROM portfolio_positions WHERE user_id = $1 AND symbol = $2 FOR UPDATE`,
      [buyerId, symbol]
    );

    if (buyerPos.rows.length === 0) {
      await client.query(
        `INSERT INTO portfolio_positions (user_id, symbol, shares, average_price) VALUES ($1, $2, $3, $4)`,
        [buyerId, symbol, quantity, price]
      );
    } else {
      const { shares, average_price } = buyerPos.rows[0];
      const newShares = Number(shares) + quantity;
      const newAvg = (Number(shares) * Number(average_price) + cost) / newShares;
      await client.query(
        `UPDATE portfolio_positions SET shares = $1, average_price = $2 WHERE user_id = $3 AND symbol = $4`,
        [newShares, newAvg, buyerId, symbol]
      );
    }

    // Seller: cash increases, position decreases
    await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [cost, sellerId]);

    const sellerPos = await client.query(
      `SELECT shares, average_price FROM portfolio_positions WHERE user_id = $1 AND symbol = $2 FOR UPDATE`,
      [sellerId, symbol]
    );

    if (sellerPos.rows.length > 0) {
      const { shares, average_price } = sellerPos.rows[0];
      const newShares = Math.max(0, Number(shares) - quantity);
      await client.query(
        `UPDATE portfolio_positions SET shares = $1, average_price = $2 WHERE user_id = $3 AND symbol = $4`,
        [newShares, newShares === 0 ? 0 : average_price, sellerId, symbol]
      );
    }
    // If the seller had no tracked position (e.g. seeded short demo data), we simply
    // skip decrementing further; a production system would support margin/short accounts.
  });
}

export async function getPortfolio(pool, userId) {
  const userRes = await pool.query(`SELECT id, name, email, balance FROM users WHERE id = $1`, [userId]);
  const positionsRes = await pool.query(
    `SELECT symbol, shares, average_price FROM portfolio_positions WHERE user_id = $1 AND shares > 0`,
    [userId]
  );
  return { user: userRes.rows[0], positions: positionsRes.rows };
}
