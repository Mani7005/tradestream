# TradeStream — Real-Time Stock Exchange Matching Engine

A distributed stock trading simulator implementing a real-time limit order book, price-time priority matching engine, Kafka event pipeline, WebSocket market feed, portfolio service, and a React trading dashboard.

## Architecture

```
React Dashboard (Vite)
        |
   REST + WebSocket
        |
  Express API Gateway  ---->  Kafka (orders topic)
        |                            |
  Postgres (orders,            Matching Engine (consumer)
  trades, users,                     |
  portfolios)            Order Book: Max-Heap (buys) / Min-Heap (sells)
        |                            |
      Redis  <----------------  Trades + Book Snapshots
        |                            |
        +------ Socket.IO broadcast (live prices, book, trades) ------+
```

## Why this is more than a CRUD app

- **Matching engine**: price-time priority matching with full support for partial fills, market orders, and stop-loss orders that convert to market orders once triggered.
- **Order book**: two binary heaps per symbol — a max-heap for buy orders (highest price wins) and a min-heap for sell orders (lowest price wins) — exactly how real exchanges prioritize orders.
- **Event-driven pipeline**: orders are published to Kafka and consumed asynchronously by the matching engine, decoupling order intake from execution the way a real trading system would.
- **Real-time fan-out**: every trade and order book change is broadcast over WebSockets (Socket.IO) so all connected clients see updates instantly, no polling.
- **Candlestick aggregation**: OHLCV candles are computed directly from the trades table on a configurable interval.
- **Rate limiting**: a token-bucket limiter protects the order placement endpoint from abuse.
- **Audit log**: every order placement, cancellation, and trade execution is published to a dedicated Kafka topic for traceability.

## Project layout

```
tradestream/
  docker-compose.yml       # Postgres, Redis, Kafka+Zookeeper, backend, frontend
  backend/
    sql/schema.sql         # Postgres schema
    src/
      matchingEngine/      # Heap + OrderBook + MatchingEngine (the core)
      kafka/                # producer/consumer wiring
      services/             # portfolio + market data services
      routes/                # REST API (auth, orders, portfolio, market)
      websocket.js
      index.js              # app entrypoint
      seed.js               # creates a demo user
  frontend/
    src/
      pages/                # Dashboard, Trade, OrderBook, Portfolio, History
      lib/                  # api client, socket client, auth context
```

## Running it

### With Docker (recommended)

```bash
docker compose up --build
```

This starts Zookeeper, Kafka, Postgres (auto-applies `schema.sql`), Redis, the backend on `:4000`, and the frontend on `:5173`.

Once containers are healthy, seed a demo user:

```bash
docker compose exec backend node src/seed.js
```

Then open http://localhost:5173 and log in with `demo@tradestream.io` / `password123`.

### Without Docker

You'll need local Postgres, Redis, and Kafka running, then:

```bash
cd backend
cp .env.example .env   # adjust connection strings if needed
npm install
npm run seed
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

## Core algorithm

- **Buy orders** rest in a **max-heap** keyed on price (ties broken by arrival order — FIFO), so the highest bidder is always matched first.
- **Sell orders** rest in a **min-heap** keyed on price (ties broken by arrival order), so the lowest asking price is always matched first.
- A trade executes whenever `bestBid.price >= bestAsk.price`. The execution price is the **resting** order's price (price-time priority).
- **Partial fills**: if order sizes don't match exactly, the larger order's remainder stays in the book at its original priority.
- **Market orders** take the best available opposite-side price immediately; if the book is empty they fall back to the last traded price.
- **Stop-loss orders** sit dormant until the last traded price crosses the trigger, at which point they convert into a market order.

## Resume entry

**TradeStream – Real-Time Stock Exchange Matching Engine | React, Node.js, PostgreSQL, Redis, Kafka, Socket.IO, Docker**

- Designed and implemented a low-latency stock exchange simulator featuring a price-time priority matching engine using max-heap and min-heap order books, with support for limit, market, and stop-loss orders and partial fills.
- Built an event-driven order pipeline on Kafka decoupling order intake from matching, with a real-time trading dashboard powered by WebSocket market data, live order book depth, and trade execution feeds.
- Developed RESTful APIs with JWT authentication, PostgreSQL persistence, Redis caching, rate limiting, and an audit event log for full trade traceability.
- Containerized the full stack (Postgres, Redis, Kafka, backend, frontend) with Docker Compose for one-command local deployment.

## Notes / things to extend further

- The matching engine here runs as a single Kafka consumer for determinism; a production system would shard consumers by symbol.
- Short selling isn't modeled — sellers must hold the position they're selling.
- Market data is a simulated random walk seeded from realistic starting prices rather than a live feed; swap `marketDataService.js` for a real AlphaVantage/Yahoo Finance call if needed.
