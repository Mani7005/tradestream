import { EventEmitter } from "events";

/**
 * Minimal in-process pub/sub that mirrors the small slice of the Kafka API this app
 * uses (publish a message to a topic, subscribe a handler to a topic). Used as a free,
 * zero-infrastructure fallback for deployments where a managed Kafka broker isn't
 * configured (e.g. KAFKA_BROKERS is unset). The real KafkaJS producer/consumer path
 * is still the default whenever KAFKA_BROKERS is set, so local dev / the Docker
 * Compose stack continues to exercise real Kafka.
 */
class LocalBus extends EventEmitter {
  publish(topic, message) {
    // Emulate Kafka's at-least-once, async dispatch semantics with a microtask tick
    // so callers can't accidentally rely on synchronous delivery.
    queueMicrotask(() => this.emit(topic, message));
  }

  subscribe(topic, handler) {
    this.on(topic, (message) => {
      Promise.resolve(handler(message)).catch((err) => {
        console.error(`[local-bus] handler error on topic "${topic}":`, err);
      });
    });
  }
}

export const localBus = new LocalBus();
