import { env } from "./config/env";
import server from "./app";
import { gracefulShutdown } from "./lib/shutdown";

server.listen(env.port, "0.0.0.0", () => {
  console.log(`Server is running at https://localhost:${env.port}`);
});

// Lắng nghe tín hiệu hệ thống
process.on("SIGINT", gracefulShutdown); // Ctrl+C
process.on("SIGTERM", gracefulShutdown); // Docker stop
