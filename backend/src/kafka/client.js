import { Kafka, logLevel } from "kafkajs";
import { localBus } from "./localBus.js";

export const TOPICS = {
  ORDERS: "orders",
  TRADES: "trades",
  AUDIT: "audit-log",
};

/**
 * USE_KAFKA controls whether this app talks to a real Kafka broker or falls back to
 * an in-process pub/sub bus. Real Kafka is used by default for local dev / Docker
 * Compose (KAFKA_BROKERS is set there). For free-tier deployments without a managed
 * Kafka broker available, set USE_KAFKA=false (or simply omit KAFKA_BROKERS) and the
 * app transparently uses localBus instead -- same publish/subscribe call sites,
 * same decoupled order-intake-to-matching-engine architecture, just without an
 * external broker dependency.
 */
export const USE_KAFKA = process.env.USE_KAFKA !== "false" && !!process.env.KAFKA_BROKERS;

const brokers = (process.env.KAFKA_BROKERS || "localhost:9092").split(",");
const useSasl = process.env.KAFKA_SASL_USERNAME && process.env.KAFKA_SASL_PASSWORD;

export const kafka = USE_KAFKA
  ? new Kafka({
      clientId: "tradestream-backend",
      brokers,
      ssl: process.env.KAFKA_SSL === "true" || useSasl ? true : undefined,
      sasl: useSasl
        ? {
            mechanism: process.env.KAFKA_SASL_MECHANISM || "scram-sha-256",
            username: process.env.KAFKA_SASL_USERNAME,
            password: process.env.KAFKA_SASL_PASSWORD,
          }
        : undefined,
      logLevel: logLevel.NOTHING,
      retry: { initialRetryTime: 300, retries: 10 },
    })
  : null;

export const producer = USE_KAFKA ? kafka.producer() : null;

export async function connectProducer() {
  if (!USE_KAFKA) {
    console.log("[event-bus] KAFKA_BROKERS not set — using in-process event bus instead of Kafka");
    return;
  }
  await producer.connect();
  console.log("[kafka] producer connected");
}

export async function publishOrder(order) {
  if (!USE_KAFKA) return localBus.publish(TOPICS.ORDERS, order);
  await producer.send({
    topic: TOPICS.ORDERS,
    messages: [{ key: order.symbol, value: JSON.stringify(order) }],
  });
}

export async function publishTrade(trade) {
  if (!USE_KAFKA) return localBus.publish(TOPICS.TRADES, trade);
  await producer.send({
    topic: TOPICS.TRADES,
    messages: [{ key: trade.symbol, value: JSON.stringify(trade) }],
  });
}

export async function publishAudit(eventType, payload) {
  const message = { eventType, payload, ts: Date.now() };
  if (!USE_KAFKA) return localBus.publish(TOPICS.AUDIT, message);
  await producer.send({
    topic: TOPICS.AUDIT,
    messages: [{ key: eventType, value: JSON.stringify(message) }],
  });
}

export function createConsumer(groupId) {
  return USE_KAFKA ? kafka.consumer({ groupId }) : null;
}
