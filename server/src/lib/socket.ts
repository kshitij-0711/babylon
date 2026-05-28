import { Server } from "socket.io";
import { Server as HttpServer } from "http";

let io: Server;

export const initSocket = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "*",
    },
  });

  io.on("connection", (socket) => {
    socket.on("join_market", ({ marketId }) => {
      if (marketId) {
        socket.join(`market:${marketId}`);
      }
    });

    socket.on("leave_market", ({ marketId }) => {
      if (marketId) {
        socket.leave(`market:${marketId}`);
      }
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};
