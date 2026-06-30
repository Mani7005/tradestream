import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { getSocket } from "../lib/socket.js";

const SYMBOLS = ["AAPL", "TSLA", "NVDA", "GOOGL", "MSFT"];

export default function OrderBookPage() {
  const [symbol, setSymbol] = useState("AAPL");
  const [book, setBook] = useState({ bids: [], asks: [] });
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    let active = true;
    api.get(`/orders/book/${symbol}`).then(({ data }) => {
      if (active) setBook(data);
    });
    setTrades([]);

    const socket = getSocket();
    if (socket) {
      socket.emit("subscribe:symbol", symbol);
      const onBook = (snapshot) => {
        if (snapshot.symbol === symbol) setBook(snapshot);
      };
      const onTrade = (trade) => {
        if (trade.symbol === symbol) setTrades((prev) => [trade, ...prev].slice(0, 30));
      };
      socket.on("orderbook:update", onBook);
      socket.on("trade", onTrade);
      return () => {
        active = false;
        socket.emit("unsubscribe:symbol", symbol);
        socket.off("orderbook:update", onBook);
        socket.off("trade", onTrade);
      };
    }
    return () => { active = false; };
  }, [symbol]);

  return (
    <div>
      <h2>Order Book</h2>
      <div className="symbol-tabs">
        {SYMBOLS.map((s) => (
          <div key={s} className={`symbol-tab ${s === symbol ? "active" : ""}`} onClick={() => setSymbol(s)}>
            {s}
          </div>
        ))}
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="stat-label" style={{ marginBottom: 12 }}>{symbol} Depth</div>
          <div style={{ display: "flex", gap: 24 }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: "var(--green)", fontSize: 13, marginBottom: 6 }}>BUY (Bids)</div>
              <table>
                <thead><tr><th>Price</th><th>Qty</th></tr></thead>
                <tbody>
                  {book.bids.map((b, i) => (
                    <tr key={i}><td className="up">${b.price.toFixed(2)}</td><td>{b.quantity}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 6 }}>SELL (Asks)</div>
              <table>
                <thead><tr><th>Price</th><th>Qty</th></tr></thead>
                <tbody>
                  {book.asks.map((a, i) => (
                    <tr key={i}><td className="down">${a.price.toFixed(2)}</td><td>{a.quantity}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="stat-label" style={{ marginBottom: 12 }}>Live Trades</div>
          <table>
            <thead><tr><th>Price</th><th>Qty</th><th>Time</th></tr></thead>
            <tbody>
              {trades.map((t, i) => (
                <tr key={i}>
                  <td>${Number(t.price).toFixed(2)}</td>
                  <td>{t.quantity}</td>
                  <td>{new Date().toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
