import { setLatestPrice, getLatestPrice } from "../redisClient.js";

export const SYMBOLS = ["AAPL", "TSLA", "NVDA", "GOOGL", "MSFT"];

const SEED_PRICES = { AAPL: 190, TSLA: 250, NVDA: 120, GOOGL: 175, MSFT: 430 };

/**
 * In production this would call AlphaVantage / Yahoo Finance. To keep the simulator
 * self-contained and free of external API keys, this generates a realistic random walk
 * seeded from real-world-ish starting prices, on the same cadence (every minute) the
 * project spec calls for. Swap fetchExternalPrice() for a real API call when ready.
 */
export function startMarketDataFeed(io, intervalMs = 5000) {
  SYMBOLS.forEach(async (symbol) => {
    const existing = await getLatestPrice(symbol);
    if (!existing) await setLatestPrice(symbol, SEED_PRICES[symbol]);
  });

  setInterval(async () => {
    for (const symbol of SYMBOLS) {
      const current = Number((await getLatestPrice(symbol)) || SEED_PRICES[symbol]);
      const pctMove = (Math.random() - 0.5) * 0.01; // +/-0.5% drift
      const next = Math.max(1, current * (1 + pctMove));
      const rounded = Math.round(next * 100) / 100;
      await setLatestPrice(symbol, rounded);
      io.emit("market:price", { symbol, price: rounded, timestamp: Date.now() });
    }
  }, intervalMs);

  console.log("[market-data] feed started");
}
