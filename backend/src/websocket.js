import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "./middleware/auth.js";

export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        socket.user = jwt.verify(token, JWT_SECRET);
      } catch {
        // allow anonymous connections for public market data; just skip user room join
      }
    }
    next();
  });

  io.on("connection", (socket) => {
    if (socket.user) {
      socket.join(`user:${socket.user.id}`);
    }

    socket.on("subscribe:symbol", (symbol) => {
      socket.join(`symbol:${symbol.toUpperCase()}`);
    });

    socket.on("unsubscribe:symbol", (symbol) => {
      socket.leave(`symbol:${symbol.toUpperCase()}`);
    });

    socket.on("disconnect", () => {});
  });

  return io;
}
