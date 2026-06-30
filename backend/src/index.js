import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.js";
import orderRoutes from "./routes/orders.js";
import portfolioRoutes from "./routes/portfolio.js";
import marketRoutes from "./routes/market.js";

import { createSocketServer } from "./websocket.js";
import { connectProducer } from "./kafka/client.js";
import { startMatchingConsumer } from "./kafka/matchingConsumer.js";
import { startMarketDataFeed } from "./services/marketDataService.js";
import { pool } from "./db.js";

const PORT = process.env.PORT || 4000;

async function waitForPostgres(retries = 20, delayMs = 1500) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query("SELECT 1");
      console.log("[postgres] connected");
      return;
    } catch (err) {
      console.log(`[postgres] not ready yet (attempt ${i + 1}/${retries})...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error("Postgres did not become ready in time");
}

async function waitForKafka(retries = 20, delayMs = 1500) {
  for (let i = 0; i < retries; i++) {
    try {
      await connectProducer();
      return;
    } catch (err) {
      console.log(`[kafka] not ready yet (attempt ${i + 1}/${retries})...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error("Kafka did not become ready in time");
}

async function main() {
  await waitForPostgres();
  await waitForKafka();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/auth", authRoutes);
  app.use("/orders", orderRoutes);
  app.use("/portfolio", portfolioRoutes);
  app.use("/market", marketRoutes);

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Unexpected server error" });
  });

  const httpServer = http.createServer(app);
  const io = createSocketServer(httpServer);

  await startMatchingConsumer(io);
  startMarketDataFeed(io);

  httpServer.listen(PORT, () => {
    console.log(`[tradestream] backend listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
