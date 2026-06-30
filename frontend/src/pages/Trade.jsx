import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { getSocket } from "../lib/socket.js";

const SYMBOLS = ["AAPL", "TSLA", "NVDA", "GOOGL", "MSFT"];

export default function Trade() {
  const [symbol, setSymbol] = useState("AAPL");
  const [side, setSide] = useState("BUY");
  const [orderType, setOrderType] = useState("LIMIT");
  const [price, setPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [quantity, setQuantity] = useState(10);
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  async function loadOrders() {
    const { data } = await api.get("/orders");
    setOrders(data.orders);
  }

  useEffect(() => {
    loadOrders();
    const socket = getSocket();
    if (!socket) return;
    const onOrderUpdate = () => loadOrders();
    socket.on("order:update", onOrderUpdate);
    return () => socket.off("order:update", onOrderUpdate);
  }, []);

  async function submitOrder(e) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    try {
      const payload = {
        symbol,
        side,
        orderType,
        quantity: Number(quantity),
        price: orderType === "LIMIT" ? Number(price) : undefined,
        stopPrice: orderType === "STOP_LOSS" ? Number(stopPrice) : undefined,
      };
      const { data } = await api.post("/orders", payload);
      setMessage(`Order #${data.order.id} accepted (${data.order.status})`);
      loadOrders();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to place order");
    }
  }

  async function cancelOrder(id) {
    await api.delete(`/orders/${id}`);
    loadOrders();
  }

  return (
    <div>
      <h2>Trade</h2>
      <div className="grid grid-2">
        <div className="card">
          <form onSubmit={submitOrder}>
            <div className="form-row">
              <label>Symbol</label>
              <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
                {SYMBOLS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="form-row">
              <label>Order Type</label>
              <select value={orderType} onChange={(e) => setOrderType(e.target.value)}>
                <option value="LIMIT">Limit</option>
                <option value="MARKET">Market</option>
                <option value="STOP_LOSS">Stop Loss</option>
              </select>
            </div>

            {orderType === "LIMIT" && (
              <div className="form-row">
                <label>Limit Price</label>
                <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
              </div>
            )}

            {orderType === "STOP_LOSS" && (
              <div className="form-row">
                <label>Stop Trigger Price</label>
                <input type="number" step="0.01" value={stopPrice} onChange={(e) => setStopPrice(e.target.value)} required />
              </div>
            )}

            <div className="form-row">
              <label>Quantity</label>
              <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className={side === "BUY" ? "buy" : ""}
                style={{ flex: 1, opacity: side === "BUY" ? 1 : 0.5 }}
                onClick={() => setSide("BUY")}
              >
                BUY
              </button>
              <button
                type="button"
                className={side === "SELL" ? "sell" : ""}
                style={{ flex: 1, opacity: side === "SELL" ? 1 : 0.5 }}
                onClick={() => setSide("SELL")}
              >
                SELL
              </button>
            </div>

            <div style={{ marginTop: 16 }}>
              <button className="primary" type="submit">Place Order</button>
            </div>

            {message && <div style={{ color: "var(--green)", marginTop: 10, fontSize: 13 }}>{message}</div>}
            {error && <div className="error-text">{error}</div>}
          </form>
        </div>

        <div className="card">
          <div className="stat-label" style={{ marginBottom: 12 }}>Your Orders</div>
          <table>
            <thead>
              <tr><th>Symbol</th><th>Side</th><th>Type</th><th>Price</th><th>Qty</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.symbol}</td>
                  <td><span className={`badge ${o.side === "BUY" ? "buy" : "sell"}`}>{o.side}</span></td>
                  <td>{o.order_type}</td>
                  <td>{o.price ? `$${Number(o.price).toFixed(2)}` : "—"}</td>
                  <td>{o.remaining_quantity}/{o.quantity}</td>
                  <td><span className="badge status">{o.status}</span></td>
                  <td>
                    {["OPEN", "PARTIAL", "PENDING"].includes(o.status) && (
                      <button onClick={() => cancelOrder(o.id)} style={{ fontSize: 12, padding: "4px 8px" }}>Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
