import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setAuthToken } from "./api.js";
import { connectSocket, disconnectSocket } from "./socket.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const applySession = useCallback((newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    setAuthToken(newToken);
    connectSocket(newToken);
  }, []);

  const login = useCallback(
    async (email, password) => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.post("/auth/login", { email, password });
        applySession(data.token, data.user);
      } catch (err) {
        setError(err.response?.data?.error || "Login failed");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [applySession]
  );

  const signup = useCallback(
    async (name, email, password) => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.post("/auth/signup", { name, email, password });
        applySession(data.token, data.user);
      } catch (err) {
        setError(err.response?.data?.error || "Signup failed");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [applySession]
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setAuthToken(null);
    disconnectSocket();
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, error, login, signup, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
