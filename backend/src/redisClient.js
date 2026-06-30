import Redis from "ioredis";

export const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

redis.on("error", (err) => {
  console.error("[redis] connection error:", err.message);
});

export async function setLatestPrice(symbol, price) {
  await redis.set(`price:${symbol}`, price);
  await redis.zadd("active_symbols", Date.now(), symbol);
}

export async function getLatestPrice(symbol) {
  return redis.get(`price:${symbol}`);
}

export async function cacheOrderBookSnapshot(symbol, snapshot) {
  await redis.set(`orderbook:${symbol}`, JSON.stringify(snapshot));
}

export async function getOrderBookSnapshot(symbol) {
  const raw = await redis.get(`orderbook:${symbol}`);
  return raw ? JSON.parse(raw) : null;
}
