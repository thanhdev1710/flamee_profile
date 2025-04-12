import { Server } from "socket.io";
import http from "http";
import userService from "../services/user.service";

const onlineUsers = new Map<string, string>(); // userId -> socket.id

export const initSocket = (server: http.Server) => {
  const io = new Server(server, {
    cors: { origin: process.env.ORIGIN_FE },
  });

  io.on("connection", async (socket) => {
    const userId = socket.handshake.query.userId as string;
    if (!userId) return;

    console.log(`${userId} connected`);
    onlineUsers.set(userId, socket.id);

    // Lấy danh sách bạn bè
    const friendIds = await userService.getFriendIds(userId);

    // Gửi trạng thái bạn bè đang online hiện tại
    const onlineFriends = friendIds.filter((fid) => onlineUsers.has(fid));
    socket.emit("initial-friend-statuses", {
      online: onlineFriends,
    });

    // Gửi sự kiện online đến bạn bè của user mới vào
    friendIds.forEach((fid) => {
      const socketId = onlineUsers.get(fid);
      if (socketId) {
        io.to(socketId).emit("user-online", { userId });
      }
    });

    socket.on("disconnect", async () => {
      console.log(`${userId} disconnected`);
      onlineUsers.delete(userId);

      const friendIds = await userService.getFriendIds(userId);
      friendIds.forEach((fid) => {
        const socketId = onlineUsers.get(fid);
        if (socketId) {
          io.to(socketId).emit("user-offline", { userId });
        }
      });
    });
  });

  return io;
};
