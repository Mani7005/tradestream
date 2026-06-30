import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/authContext.jsx";

export default function TradeHistory() {
  const [trades, setTrades] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    api.get("/portfolio/trades").then(({ data }) => setTrades(data.trades));
  }, []);

  return (
    <div>
      <h2>Trade History</h2>
      <div className="card">
        <table>
          <thead>
            <tr><th>Symbol</th><th>Side</th><th>Price</th><th>Qty</th><th>Time</th></tr>
          </thead>
          <tbody>
            {trades.length === 0 && (
              <tr><td colSpan={5} style={{ color: "var(--muted)" }}>No completed trades yet.</td></tr>
            )}
            {trades.map((t) => {
              const isBuyer = t.buyer_id === user?.id;
              return (
                <tr key={t.id}>
                  <td>{t.symbol}</td>
                  <td><span className={`badge ${isBuyer ? "buy" : "sell"}`}>{isBuyer ? "BOUGHT" : "SOLD"}</span></td>
                  <td>${Number(t.price).toFixed(2)}</td>
                  <td>{t.quantity}</td>
                  <td>{new Date(t.executed_at).toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
