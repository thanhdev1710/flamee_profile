import { Server } from "socket.io";
import http from "http";
import { redis } from "./redis";

export const initSocket = (server: http.Server) => {
  const io = new Server(server, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId as string;

    if (!userId) return;

    // Thêm userId vào danh sách online
    redis.sadd("online_users", userId);

    console.log(`${userId} connected`);

    socket.broadcast.emit("user-online", { userId });

    socket.on("disconnect", async () => {
      console.log(`${userId} disconnected`);

      // Xoá userId khỏi danh sách online
      await redis.srem("online_users", userId);

      socket.broadcast.emit("user-offline", { userId });
    });
  });

  return io;
};
