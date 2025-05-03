import { getNatsClient } from "./nats";
import { prisma } from "./prisma";
import { redis } from "./redis";

export async function gracefulShutdown() {
  console.log("\n🛑 Đang dừng ứng dụng...");

  // Đóng Prisma
  try {
    await prisma.$disconnect();
    console.log("✅ Đã ngắt Prisma");
  } catch (err) {
    console.error("❌ Lỗi ngắt Prisma:", err);
  }

  // Đóng Redis
  try {
    await redis.quit(); // hoặc redis.disconnect()
    console.log("✅ Đã ngắt Redis");
  } catch (err) {
    console.error("❌ Lỗi ngắt Redis:", err);
  }

  // Đóng NATS
  try {
    const nats = await getNatsClient();
    await nats.drain(); // drain đảm bảo mọi publish/subscribe được xử lý
    console.log("✅ Đã ngắt NATS");
  } catch (err) {
    console.error("❌ Lỗi ngắt NATS:", err);
  }

  process.exit(0);
}
