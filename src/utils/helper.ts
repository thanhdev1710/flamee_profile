import { Request } from "express";
import AppError from "./error/AppError";

export function getUserLogin(req: Request) {
  const userId = (req as any).user?.sub as string;
  const email = (req as any).user?.email as string;

  if (!userId || !email) {
    throw new AppError("Vui lòng đăng nhập", 403);
  }

  return { userId, email };
}
