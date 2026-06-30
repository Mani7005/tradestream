import React from "react";
import { Routes, Route, Navigate, NavLink } from "react-router-dom";
import { useAuth } from "./lib/authContext.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Trade from "./pages/Trade.jsx";
import OrderBookPage from "./pages/OrderBookPage.jsx";
import Portfolio from "./pages/Portfolio.jsx";
import TradeHistory from "./pages/TradeHistory.jsx";

function Protected({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function Shell({ children }) {
  const { user, logout } = useAuth();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo">Trade<span>Stream</span></div>
        <NavLink to="/" end className="nav-link">Dashboard</NavLink>
        <NavLink to="/trade" className="nav-link">Trade</NavLink>
        <NavLink to="/orderbook" className="nav-link">Order Book</NavLink>
        <NavLink to="/portfolio" className="nav-link">Portfolio</NavLink>
        <NavLink to="/history" className="nav-link">Trade History</NavLink>
        <div style={{ marginTop: "auto", paddingTop: 24 }}>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>{user?.email}</div>
          <button onClick={logout} style={{ width: "100%" }}>Log out</button>
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <Shell><Dashboard /></Shell>
          </Protected>
        }
      />
      <Route
        path="/trade"
        element={
          <Protected>
            <Shell><Trade /></Shell>
          </Protected>
        }
      />
      <Route
        path="/orderbook"
        element={
          <Protected>
            <Shell><OrderBookPage /></Shell>
          </Protected>
        }
      />
      <Route
        path="/portfolio"
        element={
          <Protected>
            <Shell><Portfolio /></Shell>
          </Protected>
        }
      />
      <Route
        path="/history"
        element={
          <Protected>
            <Shell><TradeHistory /></Shell>
          </Protected>
        }
      />
    </Routes>
  );
}
