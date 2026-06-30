import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/authContext.jsx";

export default function Login() {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("demo@tradestream.io");
  const [password, setPassword] = useState("password123");
  const { login, signup, error, loading } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (mode === "login") await login(email, password);
      else await signup(name, email, password);
      navigate("/");
    } catch {
      // error already captured in context
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="card auth-card">
        <div className="logo" style={{ marginBottom: 20, fontSize: 22, fontWeight: 700 }}>
          Trade<span style={{ color: "var(--accent)" }}>Stream</span>
        </div>
        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <div className="form-row">
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div className="form-row">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-row">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="primary" type="submit" disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
          </button>
          {error && <div className="error-text">{error}</div>}
        </form>
        <div style={{ marginTop: 16, fontSize: 13, color: "var(--muted)" }}>
          {mode === "login" ? (
            <>No account? <a href="#" onClick={() => setMode("signup")}>Sign up</a></>
          ) : (
            <>Already have an account? <a href="#" onClick={() => setMode("login")}>Log in</a></>
          )}
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
          Demo login is pre-filled: demo@tradestream.io / password123 (run the backend seed script first).
        </div>
      </div>
    </div>
  );
}
