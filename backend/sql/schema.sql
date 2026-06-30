-- TradeStream database schema

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    balance NUMERIC(18, 2) NOT NULL DEFAULT 100000.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(4) NOT NULL CHECK (side IN ('BUY', 'SELL')),
    order_type VARCHAR(10) NOT NULL DEFAULT 'LIMIT' CHECK (order_type IN ('LIMIT', 'MARKET', 'STOP_LOSS')),
    price NUMERIC(18, 4),
    stop_price NUMERIC(18, 4),
    quantity INTEGER NOT NULL,
    remaining_quantity INTEGER NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'PARTIAL', 'FILLED', 'CANCELLED', 'PENDING')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_symbol_side_status ON orders(symbol, side, status);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);

CREATE TABLE IF NOT EXISTS trades (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    buy_order_id INTEGER NOT NULL REFERENCES orders(id),
    sell_order_id INTEGER NOT NULL REFERENCES orders(id),
    buyer_id INTEGER NOT NULL REFERENCES users(id),
    seller_id INTEGER NOT NULL REFERENCES users(id),
    price NUMERIC(18, 4) NOT NULL,
    quantity INTEGER NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);

CREATE TABLE IF NOT EXISTS portfolio_positions (
    user_id INTEGER NOT NULL REFERENCES users(id),
    symbol VARCHAR(20) NOT NULL,
    shares INTEGER NOT NULL DEFAULT 0,
    average_price NUMERIC(18, 4) NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, symbol)
);

CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- seed a demo user: email demo@tradestream.io / password "password123"
-- password hash generated with bcrypt, inserted at runtime by seed script instead.
