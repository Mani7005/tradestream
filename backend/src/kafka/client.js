import { Kafka, logLevel } from "kafkajs";

export const TOPICS = {
  ORDERS: "orders",
  TRADES: "trades",
  AUDIT: "audit-log",
};

const brokers = (process.env.KAFKA_BROKERS || "localhost:9092").split(",");

export const kafka = new Kafka({
  clientId: "tradestream-backend",
  brokers,
  logLevel: logLevel.NOTHING,
  retry: { initialRetryTime: 300, retries: 10 },
});

export const producer = kafka.producer();

export async function connectProducer() {
  await producer.connect();
  console.log("[kafka] producer connected");
}

export async function publishOrder(order) {
  await producer.send({
    topic: TOPICS.ORDERS,
    messages: [{ key: order.symbol, value: JSON.stringify(order) }],
  });
}

export async function publishTrade(trade) {
  await producer.send({
    topic: TOPICS.TRADES,
    messages: [{ key: trade.symbol, value: JSON.stringify(trade) }],
  });
}

export async function publishAudit(eventType, payload) {
  await producer.send({
    topic: TOPICS.AUDIT,
    messages: [{ key: eventType, value: JSON.stringify({ eventType, payload, ts: Date.now() }) }],
  });
}

export function createConsumer(groupId) {
  return kafka.consumer({ groupId });
}
