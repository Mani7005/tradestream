import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { getSocket } from "../lib/socket.js";

export default function Dashboard() {
  const [portfolio, setPortfolio] = useState(null);
  const [symbols, setSymbols] = useState([]);

  async function load() {
    const [{ data: p }, { data: m }] = await Promise.all([
      api.get("/portfolio"),
      api.get("/market/symbols"),
    ]);
    setPortfolio(p);
    setSymbols(m.symbols);
  }

  useEffect(() => {
    load();
    const socket = getSocket();
    if (!socket) return;
    const onPrice = ({ symbol, price }) => {
      setSymbols((prev) => prev.map((s) => (s.symbol === symbol ? { ...s, price } : s)));
    };
    const onPortfolioUpdate = () => load();
    socket.on("market:price", onPrice);
    socket.on("portfolio:update", onPortfolioUpdate);
    return () => {
      socket.off("market:price", onPrice);
      socket.off("portfolio:update", onPortfolioUpdate);
    };
  }, []);

  if (!portfolio) return <div>Loading dashboard...</div>;

  return (
    <div>
      <h2>Dashboard</h2>
      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="stat-label">Cash Balance</div>
          <div className="stat-value">${Number(portfolio.user.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="card">
          <div className="stat-label">Portfolio Value</div>
          <div className="stat-value">${portfolio.totalMarketValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="card">
          <div className="stat-label">Net Worth</div>
          <div className="stat-value">${portfolio.netWorth.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      <div className="card">
        <div className="stat-label" style={{ marginBottom: 12 }}>Live Market Prices</div>
        <table>
          <thead>
            <tr><th>Symbol</th><th>Price</th></tr>
          </thead>
          <tbody>
            {symbols.map((s) => (
              <tr key={s.symbol}>
                <td>{s.symbol}</td>
                <td>${Number(s.price).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
