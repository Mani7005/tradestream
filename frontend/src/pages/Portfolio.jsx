import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { getSocket } from "../lib/socket.js";

export default function Portfolio() {
  const [data, setData] = useState(null);

  async function load() {
    const { data: p } = await api.get("/portfolio");
    setData(p);
  }

  useEffect(() => {
    load();
    const socket = getSocket();
    if (!socket) return;
    const refresh = () => load();
    socket.on("portfolio:update", refresh);
    socket.on("market:price", refresh);
    return () => {
      socket.off("portfolio:update", refresh);
      socket.off("market:price", refresh);
    };
  }, []);

  if (!data) return <div>Loading...</div>;

  return (
    <div>
      <h2>Portfolio</h2>
      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="stat-label">Cash</div>
          <div className="stat-value">${Number(data.user.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="card">
          <div className="stat-label">Holdings Value</div>
          <div className="stat-value">${data.totalMarketValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="card">
          <div className="stat-label">Net Worth</div>
          <div className="stat-value">${data.netWorth.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Symbol</th><th>Shares</th><th>Avg Price</th><th>Current Price</th><th>Market Value</th><th>Unrealized P&L</th>
            </tr>
          </thead>
          <tbody>
            {data.positions.length === 0 && (
              <tr><td colSpan={6} style={{ color: "var(--muted)" }}>No open positions yet — place a trade to get started.</td></tr>
            )}
            {data.positions.map((p) => (
              <tr key={p.symbol}>
                <td>{p.symbol}</td>
                <td>{p.shares}</td>
                <td>${Number(p.average_price).toFixed(2)}</td>
                <td>${Number(p.currentPrice).toFixed(2)}</td>
                <td>${p.marketValue.toFixed(2)}</td>
                <td className={p.unrealizedPnl >= 0 ? "up" : "down"}>
                  {p.unrealizedPnl >= 0 ? "+" : ""}${p.unrealizedPnl.toFixed(2)} ({p.unrealizedPnlPct.toFixed(2)}%)
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
