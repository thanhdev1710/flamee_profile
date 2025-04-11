import express, { Application, NextFunction, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";
import http from "http";

import { corsOptions, URL_API_V1 } from "./global/settingApp";
import GlobalError from "./middlewares/GlobalError";
import AppError from "./utils/error/AppError";

import profileRouter from "./routes/profile.route";
import followRouter from "./routes/follow.route";
import { initSocket } from "./lib/socket";

const app: Application = express();
const server = http.createServer(app); // Tạo server HTTP từ express

// Khởi tạo socket.io với Redis + sự kiện online/offline
initSocket(server);

// ==============================
// Middleware cấu hình hệ thống
// ==============================
app.use(morgan("dev"));
app.use(helmet()); // Bảo mật HTTP headers
app.use(cors(corsOptions)); // Cấu hình CORS
app.use(cookieParser()); // Parse cookie
app.use(express.json({ limit: "10mb" })); // Parse JSON body với giới hạn dung lượng
app.use((req, res, next) => {
  (req as any).requestTime = new Date().toISOString(); // Ghi lại thời gian request
  // Thêm tuỳ ý
  next();
});

// ==============================
// Khai báo route
// ==============================
app.use(`${URL_API_V1}/profiles`, profileRouter);
app.use(`${URL_API_V1}/follows`, followRouter);
// ==============================
// Xử lý route không tồn tại
// ==============================
app.all("*path", (req: Request, res: Response, next: NextFunction) => {
  next(
    new AppError(`Không tìm thấy đường dẫn ${req.originalUrl} trên server`, 404)
  );
});

// ==============================
// Middleware xử lý lỗi toàn cục
// ==============================
app.use(GlobalError);

export default server;
